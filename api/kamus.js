const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Config Supabase dari Environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

// Load dataset (Static JSON Backup)
const kamusPath = path.join(process.cwd(), "data", "kamus.json");
let kamusDataJSON = [];

try {
    const fileContent = fs.readFileSync(kamusPath, "utf-8");
    kamusDataJSON = JSON.parse(fileContent);
} catch (error) {
    console.error("Error loading kamus.json:", error);
}

module.exports = async (req, res) => {
    try {
        const query = (req.query.q || (req.body && req.body.query) || "").toLowerCase().trim();
        let source = 'json';

        if (supabase) {
            try {
                const { data: settingData } = await supabase.from('app_settings').select('key_value').eq('key_name', 'data_source').single();
                if (settingData && settingData.key_value) {
                    source = settingData.key_value;
                }
            } catch (err) {
                source = 'json';
            }
        }

        if (!query) {
            // Jika tidak ada query, kembalikan kata acak (untuk WOTD)
            let dailyWord = null;

            // 1. Coba ambil dari Supabase jika dikonfigurasi
            if (source === 'supabase' && supabase) {
                try {
                    const { count, error: countErr } = await supabase
                        .from('kamus_utama')
                        .select('*', { count: 'exact', head: true });

                    if (!countErr && count && count > 0) {
                        const randomIndex = Math.floor(Math.random() * count);
                        const { data: dbData, error: dbErr } = await supabase
                            .from('kamus_utama')
                            .select('*')
                            .range(randomIndex, randomIndex);

                        if (!dbErr && dbData && dbData.length > 0) {
                            dailyWord = dbData[0];
                        }
                    }
                } catch (err) {
                    console.error("Supabase WOTD crash:", err.message);
                }
            }

            // 2. Fallback ke JSON jika Supabase gagal/tidak diaktifkan
            if (!dailyWord && kamusDataJSON && kamusDataJSON.length > 0) {
                try {
                    const randIndex = Math.floor(Math.random() * kamusDataJSON.length);
                    dailyWord = kamusDataJSON[randIndex];
                } catch (err) {
                    console.error("JSON WOTD error:", err.message);
                }
            }

            if (!dailyWord) {
                return res.status(200).json({ success: true, results: [], message: "No data available" });
            }

            return res.status(200).json({
                success: true,
                isWotd: true,
                results: [dailyWord]
            });
        }

        if (query) {
            // Track search query in analytics (non-blocking)
            if (supabase) {
                (async () => {
                    try {
                        const todayStart = new Date();
                        todayStart.setUTCHours(0, 0, 0, 0);
                        const todayStr = todayStart.toISOString();

                        const { data: existingData } = await supabase
                            .from('app_analytics')
                            .select('*')
                            .gte('created_at', todayStr)
                            .eq('event_type', 'search')
                            .order('id', { ascending: false })
                            .limit(1)
                            .single();

                        if (existingData) {
                            let currentMeta = existingData.metadata || {};
                            if (!currentMeta.queries) currentMeta.queries = [];
                            currentMeta.queries.push({ query: query, time: new Date().toISOString() });
                            await supabase.from('app_analytics').update({ metadata: currentMeta }).eq('id', existingData.id);
                        } else {
                            await supabase.from('app_analytics').insert([{
                                event_type: 'search',
                                query: 'daily_summary',
                                metadata: { queries: [{ query: query, time: new Date().toISOString() }] },
                                created_at: new Date().toISOString()
                            }]);
                        }
                    } catch (err) {}
                })();
            }
        }

        let results = [];

        if (source === 'supabase' && supabase) {
            const { data: dbData, error } = await supabase
                .from('kamus_utama')
                .select('*')
                .or(`indonesia.ilike.%${query}%,dusun.ilike.%${query}%`)
                .limit(50);

            if (!error && dbData) {
                results = dbData;
            }
        } else {
            // Source JSON
            results = kamusDataJSON.filter(item => {
                const indonesiaMatch = (item.indonesia || "").toLowerCase();
                const dusunMatch = (item.dusun || "").toLowerCase();
                return indonesiaMatch.includes(query) || dusunMatch.includes(query);
            });
        }

        // Sortir hasil: yang persis sama ditaruh di atas
        results.sort((a, b) => {
            const aIndo = (a.indonesia || "").toLowerCase();
            const aDusun = (a.dusun || "").toLowerCase();
            const bIndo = (b.indonesia || "").toLowerCase();
            const bDusun = (b.dusun || "").toLowerCase();

            const aExact = aIndo === query || aDusun === query;
            const bExact = bIndo === query || bDusun === query;

            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            return 0;
        });

        // AI Fallback Translation using Groq Rotation
        if (results.length === 0 && (process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_1)) {
            const groqKeys = [
                process.env.GROQ_API_KEY,
                process.env.GROQ_API_KEY_1,
                process.env.GROQ_API_KEY_2,
                process.env.GROQ_API_KEY_3
            ].filter(k => !!k);

            const fallbackModels = ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "llama3-8b-8192", "llama-3.1-8b-instant"];

            try {
                const systemInstruction = `Bantu saya menterjemahkan KATA: "${query}".
                Tugas Anda SANGAT SEDERHANA:
                1. JIKA berakhiran 'a' dan ADA huruf 'e' di suku kata sebelumnya (meja, sepeda, kereta), ubah ke 'o' (mejo, sepedo, kereto).
                2. JIKA berakhiran 'a' dan TIDAK ADA huruf 'e' sebelumnya (apa, mana, dia), ubah ke 'e' (ape, mane, die).
                3. HANYA berikan 1 KATA hasil terjemahannya, TANPA PENJELASAN, TANPA TANDA KUTIP.`;

                let aiResult = "";
                for (const model of fallbackModels) {
                    for (const key of groqKeys) {
                        try {
                            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${key}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    model: model,
                                    messages: [{ role: "system", content: systemInstruction }],
                                    temperature: 0.2,
                                    top_p: 0.9
                                })
                            });

                            if (groqRes.ok) {
                                const data = await groqRes.json();
                                aiResult = data.choices[0].message.content.trim().replace(/^['"]|['"]$/g, '');
                                if (aiResult) break;
                            }
                        } catch (e) {}
                    }
                    if (aiResult) break;
                }

                if (aiResult) {
                    results.push({
                        indonesia: query,
                        dusun: aiResult,
                        contoh_dusun: "⚠️ Hasil Tebakan AI (Silakan ajukan usulan jika belum tepat)"
                    });
                }
            } catch (aiErr) {
                console.error("Groq AI Fallback Critical Error:", aiErr);
            }
        }

        return res.status(200).json({
            success: true,
            query: query,
            source: source,
            totalResults: results.length,
            results: results.slice(0, 50)
        });
    } catch (globalError) {
        console.error("Critical API Error in kamus.js:", globalError);
        return res.status(200).json({
            success: false,
            message: "Internal Server Error, falling back...",
            error: globalError.message,
            results: []
        });
    }
};
