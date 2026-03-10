const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Helper untuk Groq (Jika dengo mau pake Groq)
const callGroq = async (apiKey, model, systemInstruction, userPrompt) => {
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
            temperature: 0.3, // Low temp for translation accuracy
            top_p: 0.9
        })
    });
    const data = await response.json();
    return data.choices[0].message.content;
};

const kamusPath = path.join(process.cwd(), "data", "kamus.json");
let kamusData = [];
try {
    kamusData = JSON.parse(fs.readFileSync(kamusPath, "utf-8"));
} catch (e) { }

module.exports = async (req, res) => {
    const { text, direction = "id-to-dusun", userApiKey, provider = "gemini" } = req.body;

    if (!text || !userApiKey) {
        return res.status(400).json({ error: "Text ngen API Key wajib dengo isi!" });
    }

    // RAG: Cari kosa kata relevan buat bantu AI
    const keywords = text.toLowerCase().split(/\s+/);
    const relatedData = kamusData.filter(item =>
        keywords.some(kw => item.indonesia.toLowerCase().includes(kw) || item.dusun.toLowerCase().includes(kw))
    ).slice(0, 15);

    const dictionaryContext = relatedData.map(item =>
        `- ${item.indonesia} <-> ${item.dusun}${item.contoh_dusun ? ` (Contoh: ${item.contoh_id || item.indonesia} -> ${item.contoh_dusun})` : ""}`
    ).join("\n");

    const systemInstruction = `Anda adalah mesin penerjemah profesional Bahasa Indonesia <-> Bahasa Dusun PALI.
    Tugas Anda: MENERJEMAHKAN teks dengan akurat dan WAJIB mengikuti kamus yang diberikan.
    
    ATURAN KETAT:
    1. JANGAN memberikan penjelasan atau sapaan jika terjemahan berhasil. Cukup berikan hasil terjemahannya saja.
    2. PRIORITASKAN kosa kata dari REFERENSI KATA. Jika ada di kamus, WAJIB pakai kata itu.
    3. Ikuti dialek PALI: Akhiran 'e' (Mane, Ape) atau 'o' jika ada vokal 'e' di tengah (Negaro, Beso).
    4. Gunakan 'kitek' untuk 'kita'.
    5. JIKA kata yang diminta SANGAT SPESIFIK dan TIDAK ADA di kamus serta Anda tidak tahu bahasa Dusun PALI-nya, JANGAN mengarang (halusinasi). Sebaliknya, berikan pesan ramah dalam bahasa Dusun PALI bahwa kata tersebut belum ada di kamus, dan berikan REKOMENDASI kata-kata yang mirip atau sejenis yang ada di REFERENSI KATA.
    
    REFERENSI KATA (Jadikan panduan utama & rekomendasi jika kata tidak ditemukan):
    ${dictionaryContext || "Kamus tidak memiliki data yang relevan dengan pertanyaan ini."}
    
    Terjemahkan dari ${direction === "id-to-dusun" ? "Indonesia ke Dusun PALI" : "Dusun PALI ke Indonesia"}:`;

    try {
        let translatedText = "";
        if (provider === "groq") {
            translatedText = await callGroq(userApiKey, "llama-3.3-70b-versatile", systemInstruction, text);
        } else {
            const genAI = new GoogleGenerativeAI(userApiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", systemInstruction });
            const result = await model.generateContent(text);
            translatedText = (await result.response).text().trim();
        }

        res.status(200).json({
            success: true,
            original: text,
            translated: translatedText,
            direction: direction
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
