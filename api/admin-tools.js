const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const fs = require('fs');
const authCheck = require('./_utils/auth');
const pdfHandler = require('pdf-parse-fork');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ dest: 'tmp/uploads/' });

module.exports = async (req, res) => {
    const { type } = req.query;

    // Helper for Multer
    const runMulter = (req, res, field) => new Promise((resolve, reject) => {
        upload.single(field)(req, res, (err) => err ? reject(err) : resolve());
    });

    try {
        // 1. Audio Upload
        if (type === 'audio') {
            await runMulter(req, res, 'audio');
            const decoded = authCheck(req);
            if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized." });
            if (!req.file) return res.status(400).json({ success: false, message: "No file." });

            const fileBuffer = fs.readFileSync(req.file.path);
            const fileName = `audio_${Date.now()}.mp3`;
            const { error } = await supabase.storage.from('audio-kamus').upload(fileName, fileBuffer, { contentType: 'audio/mpeg' });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('audio-kamus').getPublicUrl(fileName);
            fs.unlinkSync(req.file.path);
            return res.status(200).json({ success: true, audio_url: publicUrl });
        }

        // 2. PDF Extract & Learn
        if (type === 'pdf') {
            await runMulter(req, res, 'pdf');
            const decoded = authCheck(req);
            if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized." });
            if (!req.file) return res.status(400).json({ success: false, message: "No PDF file." });

            const dataBuffer = fs.readFileSync(req.file.path);
            const data = await pdfHandler(dataBuffer);
            const fullText = data.text.trim();
            if (!fullText) return res.status(400).json({ success: false, message: "PDF kosong." });

            // Send to AI for extraction
            const systemInstruction = `Extract important Indonesian to Dusun PALI dictionary entries from this text. 
            Format: Topic + Content. Be detailed.`;
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "system", content: systemInstruction }, { role: "user", content: `Extract from this text: ${fullText.substring(0, 5000)}` }],
                    temperature: 0.1
                })
            });

            const aiData = await response.json();
            const aiContent = aiData.choices[0].message.content;

            await supabase.from('ai_learned').upsert({
                topic: `PDF: ${req.file.originalname}`,
                content: aiContent,
                source: 'admin-pdf',
                updated_at: new Date().toISOString()
            }, { onConflict: 'topic' });

            fs.unlinkSync(req.file.path);
            return res.status(200).json({ success: true, message: "PDF diproses." });
        }

    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({ success: false, message: err.message });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
