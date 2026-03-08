const fs = require('fs');
const path = require('path');

// Load dataset
const kamusPath = path.join(process.cwd(), "data", "kamus.json");
let kamusData = [];

try {
    const fileContent = fs.readFileSync(kamusPath, "utf-8");
    kamusData = JSON.parse(fileContent);
} catch (error) {
    console.error("Error loading kamus.json:", error);
}

module.exports = async (req, res) => {
    // Ambil query dari req.query (GET) atau req.body (POST)
    const query = (req.query.q || req.body.query || "").toLowerCase().trim();

    if (!query) {
        return res.status(400).json({
            success: false,
            message: "Parameter 'q' (GET) atau 'query' (POST) wajib diisi."
        });
    }

    // Filter data berdasarkan Indonesia atau Dusun
    const results = kamusData.filter(item => {
        const indonesiaMatch = item.indonesia.toLowerCase();
        const dusunMatch = item.dusun.toLowerCase();

        // Cari yang persis sama atau yang mengandung kata tersebut
        return indonesiaMatch.includes(query) || dusunMatch.includes(query);
    });

    // Sortir hasil: yang persis sama ditaruh di atas
    results.sort((a, b) => {
        const aIndo = a.indonesia.toLowerCase();
        const aDusun = a.dusun.toLowerCase();
        const bIndo = b.indonesia.toLowerCase();
        const bDusun = b.dusun.toLowerCase();

        const aExact = aIndo === query || aDusun === query;
        const bExact = bIndo === query || bDusun === query;

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
    });

    return res.status(200).json({
        success: true,
        query: query,
        totalResults: results.length,
        results: results.slice(0, 50) // Batasi 50 hasil biar enteng
    });
};
