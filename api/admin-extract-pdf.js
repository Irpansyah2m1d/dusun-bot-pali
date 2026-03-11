const { createClient } = require('@supabase/supabase-js');
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pdf = require("pdf-parse-fork");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const authCheck = require('./_utils/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer setup for temporary storage
const upload = multer({ dest: "tmp/uploads/" });

// Helper function to call Groq for extraction
const callGroqForExtraction = async (keys, text) => {
    const prompt = `
    Extract 5-10 important knowledge items from the following text about PALI/local culture. 
    Return ONLY a valid JSON array of objects with "topic" and "content" fields.
    
    TEXT:
    ${text.substring(0, 10000)}
    `;

    for (const key of keys) {
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You are a data extractor. Output ONLY a valid JSON array. No preamble." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3
                })
            });

            if (!response.ok) continue;

            const data = await response.json();
            let aiText = data.choices[0].message.content;
            const match = aiText.match(/\[[\s\S]*\]/);
            if (match) return JSON.parse(match[0]);
            return JSON.parse(aiText);
        } catch (e) {
            console.error(`Groq extraction failed for key ${key.substring(0, 8)}:`, e.message);
        }
    }
    throw new Error("Semua provider AI (Gemini & Groq) gagal memproses PDF ini.");
};

module.exports = async (req, res) => {
    upload.single("pdf")(req, res, async (err) => {
        if (err) return res.status(500).json({ success: false, message: "Upload error" });

        const decoded = authCheck(req);
        if (!decoded) {
            return res.status(401).json({ success: false, message: "Harap login kembali." });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No PDF file uploaded" });
        }

        try {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdf(dataBuffer);
            const fullText = pdfData.text;

            if (!fullText || fullText.trim().length < 50) {
                throw new Error("Teks PDF terlalu pendek atau tidak terbaca.");
            }

            let newKnowledge = [];
            const groqKeys = [
                process.env.GROQ_API_KEY,
                process.env.GROQ_API_KEY_1,
                process.env.GROQ_API_KEY_2,
                process.env.GROQ_API_KEY_3
            ].filter(k => !!k);

            try {
                const genAI = new GoogleGenerativeAI((process.env.GEMINI_API_KEY || "").trim());
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                const prompt = `
                Ekstrak informasi penting dari teks PDF ini menjadi daftar pengetahuan (knowledge base).
                FORMAT: JSON array [{"topic": "...", "content": "..."}]
                
                TEKS:
                ${fullText.substring(0, 15000)}
                `;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                let aiText = response.text().trim();
                const match = aiText.match(/\[[\s\S]*\]/);
                newKnowledge = JSON.parse(match ? match[0] : aiText);
            } catch (geminiError) {
                console.warn("Gemini 404/Error, falling back to Groq for PDF extraction...");
                newKnowledge = await callGroqForExtraction(groqKeys, fullText);
            }

            // 3. Save to Supabase
            // Kita proses satu per satu untuk upsert logic (topic as unique constraint logic)
            for (const item of newKnowledge) {
                if (!item.topic || !item.content) continue;
                
                // Cari apakah topik sudah ada
                const { data: existing } = await supabase
                    .from('pali_ai_knowledge')
                    .select('id')
                    .ilike('topic', item.topic.trim())
                    .limit(1)
                    .single();

                if (existing) {
                    await supabase
                        .from('pali_ai_knowledge')
                        .update({ 
                            content: item.content.trim(), 
                            updated_at: new Date().toISOString(),
                            source: 'manual' 
                        })
                        .eq('id', existing.id);
                } else {
                    await supabase
                        .from('pali_ai_knowledge')
                        .insert([{
                            topic: item.topic.trim(),
                            content: item.content.trim(),
                            source: 'manual',
                            updated_at: new Date().toISOString()
                        }]);
                }
            }

            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(200).json({ success: true, message: "Berhasil! Pengetahuan baru dari PDF telah disimpan ke database." });

        } catch (error) {
            console.error("PDF Process Error:", error);
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(500).json({ success: false, message: error.message });
        }
    });
};
