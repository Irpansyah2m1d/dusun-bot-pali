const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require('@supabase/supabase-js');
const fs = require("fs");
const path = require("path");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper for Groq API
const callGroq = async (apiKey, model, systemInstruction, userPrompt) => {
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model || "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "Groq API Error");
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        throw e;
    }
};

// Helper for Gemini with fallback
const callGemini = async (apiKey, modelName, systemInstruction, prompt) => {
    try {
        const genAI = new GoogleGenerativeAI((apiKey || "").trim());
        const model = genAI.getGenerativeModel({
            model: modelName || "gemini-1.5-flash",
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (e) {
        throw e;
    }
};

// Load dataset (Dictionary for Dusun Mode)
const kamusPath = path.join(process.cwd(), "data", "kamus.json");
let kamusData = [];

try {
    if (fs.existsSync(kamusPath)) {
        kamusData = JSON.parse(fs.readFileSync(kamusPath, "utf-8"));
    }
} catch (error) {
    console.error("Gagal membaca file kamus.json:", error);
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

    const { prompt, provider = "gemini", modelName, mode = "id" } = req.body;

    const groqKeys = [
        process.env.GROQ_API_KEY,
        process.env.GROQ_API_KEY_1,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3
    ].filter(k => !!k);

    let userApiKey = req.body.userApiKey;
    if (!userApiKey) {
        if (provider === 'groq') userApiKey = groqKeys[0];
        else userApiKey = process.env.GEMINI_API_KEY;
    }

    if (!prompt) return res.status(400).json({ error: "Prompt harus diisi." });

    try {
        const promptLower = prompt.toLowerCase();
        const keywords = promptLower.split(/\s+/).filter(k => k.length > 2);

        // 1. RAG Kamus (Kamus Utama dari Supabase)
        let dictionaryContext = "Gunakan dialek PALI.";
        try {
            // Kita cari kata yang mirip di kolom indonesia atau dusun
            const searchPromises = keywords.map(kw => 
                supabase
                    .from('kamus_utama')
                    .select('indonesia, dusun')
                    .or(`indonesia.ilike.%${kw}%,dusun.ilike.%${kw}%`)
                    .limit(5)
            );
            
            const searchResults = await Promise.all(searchPromises);
            const flatResults = searchResults
                .flatMap(r => r.data || [])
                .filter((v, i, a) => a.findIndex(t => (t.indonesia === v.indonesia)) === i) // unique
                .slice(0, 15);

            if (flatResults.length > 0) {
                dictionaryContext = "REFERENSI KAMUS PALI-INDONESIA:\n" + 
                    flatResults.map(item => `- Dusun: ${item.dusun} | Indonesia: ${item.indonesia}`).join("\n");
            }
        } catch (err) {
            console.error("Gagal search kamus:", err.message);
        }

        // 2. Fetch Knowledge from Supabase (RAG Pengetahuan)
        const { data: knowledgeList, error: kbError } = await supabase
            .from('pali_ai_knowledge')
            .select('*');
        
        let allKnowledge = "";
        if (!kbError && knowledgeList) {
            const relevantKB = knowledgeList.filter(k => {
                const t = k.topic.toLowerCase();
                const c = k.content.toLowerCase();
                return keywords.some(kw => t.includes(kw) || c.includes(kw));
            });
            const displayKB = relevantKB.length > 0 ? relevantKB : knowledgeList.slice(0, 8);
            allKnowledge = displayKB.map(k => `Topik: ${k.topic}\nInfo: ${k.content}`).join("\n\n");
        }

        const systemInstruction = mode === 'id'
            ? `Kamu Sagarurung BOT, asisten cerdas PALI. Jawablah dlm Bahasa Indonesia yang ramah & singkat.
            
            ${dictionaryContext}

            PENGETAHUAN REFERENSI:
            ${allKnowledge}

            ATURAN:
            1. Jika user bertanya arti kata (terjemahan), gunakan REFERENSI KAMUS di atas. Jawab dengan format singkat, misal: 'Arti [kata] dalam bahasa Dusun adalah [arti].'
            2. Jika topik ada di PENGETAHUAN REFERENSI, jawab berdasarkan itu.
            3. Jika benar-benar tidak ada di kamus maupun pengetahuan, tanyakan ke user dengan menyertakan tag [BELUM_TAHU:istilah].`
            : `Kamu ahli dialek PALI. Jawab HANYA dlm dialek PALI kental. Referensi Pengetahuan: ${allKnowledge}. Kamus: ${dictionaryContext}`;

        let aiAnswer = "";

        // 3. Dusun Mode (GAS)
        if (mode === 'dusun') {
            const GAS_URL = process.env.GAS_WEB_APP_URL;
            if (GAS_URL) {
                try {
                    const gasRes = await fetch(GAS_URL, {
                        method: 'POST',
                        body: JSON.stringify({ message: prompt, mode: "dusun" })
                    });
                    if (gasRes.ok) {
                        const gasData = await gasRes.json();
                        aiAnswer = gasData.reply || gasData.answer;
                    }
                } catch (e) {
                    console.error("GAS Fallback error:", e.message);
                }
            }
        }

        // 4. Default AI Providers with Fallback Logic
        if (!aiAnswer) {
            if (provider === 'gemini') {
                try {
                    aiAnswer = await callGemini(userApiKey, modelName, systemInstruction, prompt);
                } catch (geminiError) {
                    console.warn("Gemini Failed (possibly 404), falling back to Groq Llama...");
                    // Fallback to Groq if Gemini fails
                    aiAnswer = await callGroq(groqKeys[0], "llama-3.3-70b-versatile", systemInstruction, prompt);
                }
            } else {
                // Groq with rotation
                let lastErr = null;
                for (const key of groqKeys) {
                    try {
                        aiAnswer = await callGroq(key, modelName, systemInstruction, prompt);
                        lastErr = null;
                        break;
                    } catch (err) { lastErr = err; }
                }
                if (lastErr) throw lastErr;
            }
        }

        return res.status(200).json({ success: true, answer: aiAnswer });

    } catch (error) {
        console.error("Chat API Error:", error.message);
        return res.status(500).json({ error: "Terjadi gangguan koneksi ke AI. Coba lagi nanti." });
    }
};
