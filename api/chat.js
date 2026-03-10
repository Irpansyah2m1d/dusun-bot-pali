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

        // 1. RAG Kamus (untuk Dusun Mode atau referensi kata)
        const relatedData = kamusData
            .filter((item) => {
                const i = item.indonesia.toLowerCase();
                const d = item.dusun.toLowerCase();
                return keywords.some(kw => i.includes(kw) || d.includes(kw));
            })
            .slice(0, 15);

        const dictionaryContext = relatedData.length > 0
            ? relatedData.map(item => `- ID: ${item.indonesia} | DSN: ${item.dusun}`).join("\n")
            : "Gunakan dialek PALI.";

        // 2. Fetch Knowledge from Supabase (RAG Pengetahuan)
        // Kita ambil semua pengetahuan lalu filter sederhana (untuk dataset kecil)
        // Atau gunakan eq('topic', ...) jika sudah di-normalize
        const { data: knowledgeList, error: kbError } = await supabase
            .from('pali_ai_knowledge')
            .select('*');
        
        let allKnowledge = "";
        if (!kbError && knowledgeList) {
            // Filter pengetahuan yang relevan dengan keyword
            const relevantKB = knowledgeList.filter(k => {
                const t = k.topic.toLowerCase();
                const c = k.content.toLowerCase();
                return keywords.some(kw => t.includes(kw) || c.includes(kw));
            });

            // Jika tidak ada yang relevan lewat keyword, ambil 5 terbaru saja sebagai context general
            const displayKB = relevantKB.length > 0 ? relevantKB : knowledgeList.slice(0, 10);
            allKnowledge = displayKB.map(k => `Topik: ${k.topic}\nInfo: ${k.content}`).join("\n\n");
        }

        const systemInstruction = mode === 'id'
            ? `Kamu Sagarurung BOT, asisten cerdas kabupaten PALI (Penukal Abab Lematang Ilir). Jawablah dalam Bahasa Indonesia yang ramah, sopan, dan informatif.
            
            PENGETAHUAN REFERENSI (WAJIB DIBACA):
            ${allKnowledge}

            ATURAN JAWABAN:
            1. Jika user bertanya tentang topik yang ada di PENGETAHUAN REFERENSI di atas, kamu WAJIB menjawab berdasarkan informasi tersebut. Jangan pura-pura tidak tahu.
            2. Jika topik tersebut TIDAK ADA sama sekali di referensi, jawablah dengan jujur bahwa kamu belum mempelajarinya, lalu tanya user apakah mereka bisa memberikan penjelasan singkat.
            3. Jika benar-benar tidak tahu, sertakan tag [BELUM_TAHU:istilah] di akhir kalimat agar aku bisa belajar. Contoh: 'Waduh, aku belum tahu tentang itu. Boleh kasih tahu artinya? [BELUM_TAHU:senjang]'
            4. Prioritaskan kebenaran data dari referensi.`
            : `Kamu ahli dialek PALI. Jawab HANYA dalam dialek PALI kental. Referensi Pengetahuan: ${allKnowledge}. Kamus: ${dictionaryContext}`;

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
