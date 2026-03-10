const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pdf = require("pdf-parse-fork");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Multer setup for temporary storage
const upload = multer({ dest: "tmp/uploads/" });

const knowledgePath = path.join(process.cwd(), "data", "knowledge.json");

module.exports = async (req, res) => {
    // We wrap in multer promise since it's a serverless function structure but used in express locally
    upload.single("pdf")(req, res, async (err) => {
        if (err) return res.status(500).json({ success: false, message: "Upload error" });

        const adminPassword = req.headers['x-admin-password'];
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No PDF file uploaded" });
        }

        try {
            // 1. Extract Text from PDF
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdf(dataBuffer);
            const fullText = pdfData.text;

            if (!fullText || fullText.trim().length < 50) {
                throw new Error("Teks PDF terlalu pendek atau tidak terbaca.");
            }

            // 2. Process with AI to break down into chunks (Topics & Content)
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const prompt = `
            Berikut adalah teks dari dokumen PDF tentang Kabupaten PALI atau budaya lokal. 
            Tugas Anda adalah mengekstrak informasi penting dan mengemasnya menjadi daftar pengetahuan mandiri (knowledge base).
            
            FORMAT OUTPUT WAJIB JSON:
            [
              {"topic": "Judul Topik", "content": "Ringkasan informasi yang lengkap dan detail (1-2 paragraf)"},
              ...
            ]

            ATURAN:
            1. Buat sekitar 5-10 item pengetahuan yang paling penting.
            2. Topik harus spesifik (misal: "Sejarah Candi Bumiayu", "Visi Kabupaten PALI").
            3. Isi content harus informatif sehingga AI bisa menjawab pertanyaan user dengan data ini.
            4. Hanya kembalikan JSON saja, jangan ada teks pembuka.

            TEKS PDF:
            ${fullText.substring(0, 15000)} // Limit context to 15k chars for stability
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let aiText = response.text();

            // Clean up JSON tags if AI adds them
            aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
            const newKnowledge = JSON.parse(aiText);

            // 3. Save to knowledge.json
            let existingKnowledge = [];
            if (fs.existsSync(knowledgePath)) {
                existingKnowledge = JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
            }

            // Merge: avoid duplicates by topic name (optional basic check)
            const merged = [...existingKnowledge];
            newKnowledge.forEach(newItem => {
                const index = merged.findIndex(e => e.topic.toLowerCase() === newItem.topic.toLowerCase());
                if (index > -1) {
                    merged[index] = newItem; // Update
                } else {
                    merged.push(newItem); // Add new
                }
            });

            fs.writeFileSync(knowledgePath, JSON.stringify(merged, null, 2), "utf-8");

            // Clean up temp file
            fs.unlinkSync(req.file.path);

            return res.status(200).json({ success: true, message: "PDF processed and knowledge updated" });

        } catch (error) {
            console.error("PDF Process Error:", error);
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(500).json({ success: false, message: error.message });
        }
    });
};
