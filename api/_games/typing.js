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
        if (!kamusDataJSON || kamusDataJSON.length === 0) {
            return res.status(500).json({ success: false, message: "Kamus data is missing." });
        }

        // Filter kata yang valid (hanya yang tidak mengandung spasi atau tanda hubung supaya lebih murni "kata")
        const singleWords = kamusDataJSON.filter(w => 
            w.dusun && 
            w.dusun.trim() !== '' && 
            !w.dusun.includes(' ') && 
            !w.dusun.includes('-') &&
            !w.dusun.includes('(') &&
            !w.dusun.includes(')')
        );

        // Jika jumlah singleWords kurang dari 100, kita kembalikan semuanya, jika lebih kita potong
        const shuffledWords = shuffleArray([...singleWords]);
        const selectedWords = shuffledWords.slice(0, 150).map(w => w.dusun.toLowerCase().trim());

        return res.status(200).json({
            success: true,
            words: selectedWords
        });

    } catch (globalError) {
        console.error("Error in typing.js:", globalError);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: globalError.message
        });
    }
};
