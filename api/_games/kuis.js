const fs = require('fs');
const path = require('path');

const kamusPath = path.join(process.cwd(), "data", "kamus.json");
let kamusDataJSON = [];

try {
    const fileContent = fs.readFileSync(kamusPath, "utf-8");
    kamusDataJSON = JSON.parse(fileContent);
} catch (error) {
    console.error("Error loading kamus.json:", error);
}

// Fungsi bantu untuk mengacak array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

module.exports = async (req, res) => {
    try {
        if (!kamusDataJSON || kamusDataJSON.length < 20) {
            return res.status(500).json({ success: false, message: "Kamus data is missing or too small." });
        }

        // Filter kata yang valid (punya arti bahasa indonesia & dusun yang berbeda/ada isinya)
        const validWords = kamusDataJSON.filter(w => w.indonesia && w.dusun && w.indonesia.trim() !== '' && w.dusun.trim() !== '');

        // Ambil 20 kata acak sebagai soal utama
        const shuffledWords = shuffleArray([...validWords]);
        const selectedQuestions = shuffledWords.slice(0, 20);

        const quizQuestions = selectedQuestions.map(q => {
            // Tentukan tipe soal (misal: "Apa bahasa dusun dari X?" atau "Apa arti kata Dusun Y?")
            const isIndoToDusun = Math.random() > 0.5;
            
            let questionText, correctOption;
            if (isIndoToDusun) {
                questionText = `Apa bahasa Dusun PALI dari kata "${q.indonesia}"?`;
                correctOption = q.dusun;
            } else {
                questionText = `Apa arti dari kata bahasa Dusun PALI "${q.dusun}"?`;
                correctOption = q.indonesia;
            }

            // Cari 3 opsi salah yang acak
            let wrongOptions = [];
            while (wrongOptions.length < 3) {
                const randomWrong = validWords[Math.floor(Math.random() * validWords.length)];
                const wrongText = isIndoToDusun ? randomWrong.dusun : randomWrong.indonesia;
                
                // Pastikan bukan jawaban benar dan belum ada di array wrongOptions
                if (wrongText !== correctOption && !wrongOptions.includes(wrongText)) {
                    wrongOptions.push(wrongText);
                }
            }

            // Gabungkan dan acak opsinya
            const options = shuffleArray([correctOption, ...wrongOptions]);

            return {
                question: questionText,
                options: options,
                answer: correctOption
            };
        });

        return res.status(200).json({
            success: true,
            total: quizQuestions.length,
            questions: quizQuestions
        });

    } catch (globalError) {
        console.error("Error in kuis.js:", globalError);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: globalError.message
        });
    }
};
