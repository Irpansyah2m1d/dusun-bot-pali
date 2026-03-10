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
        const query = (req.query.q || req.body.query || "").toLowerCase().trim();
        let source = 'json';

        if (supabase) {
            try {
                const { data: settingData } = await supabase.from('app_settings').select('key_value').eq('key_name', 'data_source').single();
                if (settingData && settingData.key_value) {
                    source = settingData.key_value;
                }
            } catch (err) {
                console.error("Failed to load settings fallback to json", err);
            }
        }

        if (!query) {
            // Jika tidak ada query, kembalikan kata acak (untuk WOTD)
            let dailyWord = null;

            // 1. Coba ambil dari Supabase jika dikonfigurasi
            if (source === 'supabase' && supabase) {
                try {
                    // Teknik random di Supabase: Ambil total count lalu gunakan offset
                    const { count, error: countErr } = await supabase
                        .from('kamus_utama')
                        .select('*', { count: 'exact', head: true });

                    if (!countErr && count > 0) {
                        const randomIndex = Math.floor(Math.random() * count);
                        const { data: dbData, error: dbErr } = await supabase
                            .from('kamus_utama')
                            .select('*')
                            .range(randomIndex, randomIndex)
                            .single();

                        if (!dbErr && dbData) {
                            dailyWord = dbData;
                        }
                    }
                } catch (err) {
                    console.error("Supabase random word error:", err);
                }
            }

            // 2. Fallback ke JSON jika Supabase gagal/tidak diaktifkan
            if (!dailyWord && kamusDataJSON && kamusDataJSON.length > 0) {
                const randIndex = Math.floor(Math.random() * kamusDataJSON.length);
                dailyWord = kamusDataJSON[randIndex];
            }

            if (!dailyWord) {
                return res.status(200).json({ success: true, results: [] });
            }

            return res.status(200).json({
                success: true,
                isWotd: true,
                results: [dailyWord]
            });
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
                const indonesiaMatch = item.indonesia.toLowerCase();
                const dusunMatch = item.dusun.toLowerCase();
                return indonesiaMatch.includes(query) || dusunMatch.includes(query);
            });
        }

        // Sortir hasil: yang persis sama ditaruh di atas
        results.sort((a, b) => {
            const aIndo = a.indonesia.toLowerCase();
            const aDusun = a.dusun.toLowerCase();
            const bIndo = b.indonesia?.toLowerCase() || "";
            const bDusun = b.dusun?.toLowerCase() || "";

            const aExact = aIndo === query || aDusun === query;
            const bExact = bIndo === query || bDusun === query;

            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            return 0;
        });

        // AI Fallback Translation using Groq if no results found
        if (results.length === 0 && process.env.GROQ_API_KEY) {
            try {
                console.log(`No results for '${query}', calling Groq AI fallback...`);
                const systemInstruction = `Bantu saya menterjemahkan KATA: "${query}".

Tugas Anda SANGAT SEDERHANA:
Tebak terjemahan bahasa Dusun PALI (atau Indonesia) untuk kata tersebut dengan aturan:
1. JIKA berakhiran 'a' dan ADA huruf 'e' di suku kata sebelumnya (meja, sepeda, kereta), ubah ke 'o' (mejo, sepedo, kereto).
2. JIKA berakhiran 'a' dan TIDAK ADA huruf 'e' sebelumnya (apa, mana, dia), ubah ke 'e' (ape, mane, die).
3. HANYA berikan 1 KATA hasil terjemahannya, TANPA PENJELASAN, TANPA TANDA KUTIP.`;

                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "llama-3.3-70b-versatile",
                        messages: [{ role: "system", content: systemInstruction }],
                        temperature: 0.2,
                        top_p: 0.9
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    let aiResult = data.choices[0].message.content.trim();
                    // Clean up potential quotes
                    aiResult = aiResult.replace(/^['"]|['"]$/g, '');

                    results.push({
                        indonesia: query,
                        dusun: aiResult,
                        contoh_dusun: "⚠️ Hasil Tebakan AI (Silakan ajukan usulan jika belum tepat)"
                    });
                }
            } catch (aiErr) {
                console.error("Groq AI Fallback Error:", aiErr);
            }
        }

        return res.status(200).json({
            success: true,
            query: query,
            source: source,
            totalResults: results.length,
            results: results.slice(0, 50) // Batasi 50 hasil biar enteng
        });
    } catch (globalError) {
        console.error("Critical API Error:", globalError);
        return res.status(200).json({
            success: false,
            message: "Internal Server Error, falling back...",
            results: []
        });
    }
};
