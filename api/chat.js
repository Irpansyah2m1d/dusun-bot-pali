const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Fetch function for Groq (using native fetch or node-fetch)
// We'll use the official SDK pattern via fetch if possible, 
// but to keep it simple and compatible with Vercel, we'll use a direct fetch call to Groq API.
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
};

// Fetch function for Z.ai (OpenAI compatible)
const callZai = async (apiKey, model, systemInstruction, userPrompt) => {
    const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: model || "glm-4.7-flash",
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
        throw new Error(error.error?.message || "Z.ai API Error");
    }

    const data = await response.json();
    return data.choices[0].message.content;
};

// Load dataset
const kamusPath = path.join(process.cwd(), "data", "kamus.json");
let kamusData = [];

try {
    const fileContent = fs.readFileSync(kamusPath, "utf-8");
    kamusData = JSON.parse(fileContent);
} catch (error) {
    console.error("Gagal membaca file kamus.json:", error);
}

module.exports = async (req, res) => {
    // Hanya menerima metode POST
    // 0. Resolve API Key & Provider from Body or Env
    const { prompt, provider = "gemini", modelName, mode = "id" } = req.body;

    // Resolve Key (Body takes precedence, then Env)
    let userApiKey = req.body.userApiKey;
    if (!userApiKey) {
        if (provider === 'groq') userApiKey = process.env.GROQ_API_KEY;
        else if (provider === 'zai') userApiKey = process.env.ZAI_API_KEY;
        else userApiKey = process.env.GEMINI_API_KEY;
    }

    // Validasi input
    if (!prompt) {
        return res.status(400).json({ error: "Prompt harus diisi." });
    }
    if (!userApiKey) {
        return res.status(400).json({ error: `API Key untuk ${provider.toUpperCase()} belum dikonfigurasi di server.` });
    }

    try {
        // 1. RAG Sederhana: Cari data yang paling relevan
        const keywords = prompt.toLowerCase().split(/\s+/);
        const relatedData = kamusData
            .filter((item) => {
                const indonesiaMatch = item.indonesia.toLowerCase();
                const dusunMatch = item.dusun.toLowerCase();
                return keywords.some(
                    (kw) => kw.length >= 2 && (indonesiaMatch.includes(kw) || dusunMatch.includes(kw))
                );
            })
            .slice(0, 20); // Ambil maksimal 20 data untuk konteks lebih kaya

        // 2. Format konteks kosa kata (Termasuk contoh kalimat agar AI paham struktur)
        let dictionaryContext = relatedData.length > 0
            ? relatedData.map(item => `- Indonesia: ${item.indonesia}\n  Artie: ${item.dusun}${item.contoh_id ? `\n  Contoh ID: "${item.contoh_id}"` : ""}${item.contoh_dusun ? `\n  Contoh Dusun: "${item.contoh_dusun}"` : ""}`).join("\n\n")
            : "";

        let systemInstruction = "";

        if (mode === 'id') {
            systemInstruction = `Anda adalah Asisten Digital cerdas MASYARAKAT DUSUN PALI. Anda adalah asisten virtual resmi untuk website "Dusun Bot PALI" (atau Dusun AI).
      Tugas utama Anda adalah membantu pengguna menjawab pertanyaan dengan Bahasa Indonesia yang baik, asik, sopan, informatif, namun santai.
      
      KONTEKS PENGETAHUAN INTI:
      - Website ini adalah kamus dan ensiklopedia pelestarian Bahasa Dusun PALI (Penukal Abab Lematang Ilir).
      - Anda adalah maskot/asisten dari website ini.

      ATURAN:
      1. Jawab HANYA menggunakan Bahasa Indonesia (karena saat ini Mode Indonesian sedang aktif).
      2. Jangan menggunakan bahasa gaul yang berlebihan, tetap profesional namun ramah.
      3. Jika pengguna bertanya tentang fitur website, tugas Anda, atau tentang wilayah PALI, jawablah dengan antusias dan informatif sesuai dengan konteks pelestarian budaya.`;
        } else {
            systemInstruction = `Anda adalah Dusun Bot, penutur asli Bahasa Dusun PALI (Kabupaten PALI, Sumatera Selatan).
      Tugas Anda: Menjawab pertanyaan dalam Bahasa Dusun PALI yang KENTAL dan ALAMI.

      ATURAN DIALEK PALI (WAJIB DIIKUTI):
      1. AKHIRAN 'E' vs 'O' (HANYA UNTUK KATA BERAKHIRAN 'A'):
         - Jika kata dasar berakhiran 'a' (seperti: Apa, Mana, Ada), ubah ujungnya jadi 'e' (Ape, Mane, Ade).
         - PENGECUALIAN: Jika di tengah kata sudah ada huruf 'e' (seperti: Negar-a, Bes-ar, Kerj-a), maka akhiran 'a' menjadi 'o' (Negaro, Beso, Kerjo).
         - JANGAN menambahkan 'e' di akhir kata yang berakhiran konsonan (Contoh SALAH: Komputere, Baike). Kata 'Komputer' tetap 'Komputer'.
      2. KATA GANTI & KOSA KATA KHAS:
         - KITEK: Gunakan 'kitek' (kita).
         - BEGAWE: Gunakan 'begawe' (kerja/bekerja). JANGAN pakai 'kerje' atau 'kerjo'.
         - RIBONG: Gunakan 'ribong' (suka). JANGAN pakai 'nyuka' atau 'cuka'.
         - PACAK: Gunakan 'pacak' (bisa).
         - DENGO/NGA: Gunakan 'dengo' atau 'nga' (kamu).
      3. PINJAMAN TEKNOLOGI: Kata seperti (Komputer, Internet, Email, Game) jangan diubah-ubah ujungnya.
      4. GAYA BICARA: Santai, mengalir, pendek-pendek. JANGAN kaku.
      5. JIKA ada kata yang TIDAK ADA di referensi kamus dan Anda tidak tahu terjemahannya, Anda bisa menebak dengan aturan ini:
         - Jika kata berakhiran 'a' dan terdapat huruf 'e' di suku kata sebelumnya, jadikan akhirannya 'o' (mejo, kereto).
         - Jika kata berakhiran 'a' dan TIDAK ada huruf 'e' sebelumnya, jadikan akhirannya 'e' (ape, mane, die).
         - JIKA Anda melakukan ini, WAJIB tambahkan catatan kecil: "(Peringatan: Beberapa kata mungkin hasil generasi AI karena belum ada di kamus. Mohon bantu usulkan kata jika keliru)".

      REFERENSI KAMUS & CONTOH ASLI:
      ${dictionaryContext || "Gunakan dialek PALI kental."}

      CONTOH JAWABAN BENAR:
      User: "Jelaskan tentang Komputer"
      Bot: "Komputer tu alat kitek yang canggih nian cah, pacak nolongi kitek begawe ape bae. Kitek pacak nggunoke komputer buat nyari internet ngen ngirim email. Dengo lah ribong pakai komputer lum?"

      Jawablah dengan singkat ngen kental dialek PALI. JANGAN ngoceh idok-idok (ngawur) ngen JANGAN pakai kata-kata yang aneh. Ikuti aturan di atas biar bener. wkwkwkkw!`;
        }

        let aiAnswer = "";

        // 4. Pilih Provider (Gemini, Groq, atau Z.ai)
        if (provider.toLowerCase() === "groq") {
            // Logic Groq
            aiAnswer = await callGroq(userApiKey, modelName || "llama-3.3-70b-versatile", systemInstruction, prompt);
        } else if (provider.toLowerCase() === "zai") {
            // Logic Z.ai
            aiAnswer = await callZai(userApiKey, modelName || "glm-4.7-flash", systemInstruction, prompt);
        } else {
            // Default Gemini
            const genAI = new GoogleGenerativeAI(userApiKey);
            const model = genAI.getGenerativeModel({
                model: modelName || "gemini-flash-latest",
                systemInstruction: systemInstruction
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            aiAnswer = response.text().trim();
        }

        // 5. Kirim Response
        return res.status(200).json({
            success: true,
            provider: provider.toLowerCase(),
            answer: aiAnswer,
            referenceCount: relatedData.length
        });

    } catch (error) {
        console.error(`Error at ${provider.toUpperCase()} API:`, error);
        return res.status(500).json({
            error: `Terjadi kesalahan pada ${provider.toUpperCase()} atau API Key tidak valid.`,
            details: error.message
        });
    }
};
