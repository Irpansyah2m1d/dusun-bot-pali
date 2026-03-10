const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

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
        // Try the standard name. If 404 occurs, it will be caught.
        const model = genAI.getGenerativeModel({
            model: modelName || "gemini-1.5-flash",
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (e) {
        // If Gemini fails (404, limit, etc), we throw so the caller can fallback to Groq
        throw e;
    }
};

// Load dataset
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

    // Resolve Groq Keys for Rotation
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
        // 1. RAG Sederhana
        const keywords = prompt.toLowerCase().split(/\s+/).filter(k => k.length > 2);
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

        // 2. Load Base Knowledge
        const knowledgePath = path.join(process.cwd(), "data", "knowledge.json");
        let baseKnowledge = "";
        if (fs.existsSync(knowledgePath)) {
            try {
                const kData = JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
                baseKnowledge = kData.map(k => `T: ${k.topic}\nI: ${k.content}`).join("\n\n");
            } catch (e) { }
        }

        const systemInstruction = mode === 'id'
            ? `Kamu Sagarurung BOT, asisten PALI. Jawab dlm Bhs Indonesia ramah & singkat. Ref: ${baseKnowledge}`
            : `Kamu ahli PALI. Jawab HANYA dlm dialek PALI kental. Ref: ${baseKnowledge} Kamus: ${dictionaryContext}`;

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
