const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Config Supabase
const supabaseUrl = 'https://attspecehfhixbdfnnvn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0dHNwZWNlaGZoaXhiZGZubnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjIxMzQsImV4cCI6MjA4ODU5ODEzNH0.o3HQjQaE69i9_BnOKjOgefstaFOchZJNZkwOd2JAroA';
const supabase = createClient(supabaseUrl, supabaseKey);

// Load dataset (Static JSON Backup)
const kamusPath = path.join(process.cwd(), "data", "kamus.json");
let kamusDataJSON = [];

try {
    const fileContent = fs.readFileSync(kamusPath, "utf-8");
    kamusDataJSON = JSON.parse(fileContent);
} catch (error) {
    console.error("Error loading kamus.json:", error);
}

module.exports = async (req, res) => {
    const query = (req.query.q || req.body.query || "").toLowerCase().trim();
    let source = 'json';
    try {
        const { data: settingData } = await supabase.from('app_settings').select('key_value').eq('key_name', 'data_source').single();
        if (settingData && settingData.key_value) {
            source = settingData.key_value;
        }
    } catch (err) {
        console.error("Failed to load settings array, fallback to json", err);
    }

    if (!query) {
        // Jika tidak ada query, kembalikan kata acak (bisa digunakan untuk WOTD)
        let dailyWord = null;
        if (source === 'supabase') {
            try {
                const { data: dbData, error } = await supabase
                    .from('kamus_utama')
                    .select('*')
                    .limit(1)
                    .order('dusun', { ascending: Math.random() > 0.5 }); // Simple pseudo-random

                if (!error && dbData && dbData.length > 0) {
                    dailyWord = dbData[0];
                }
            } catch (err) {
                console.error("Supabase daily word error:", err);
            }
        }

        // Fallback or JSON source
        if (!dailyWord && kamusDataJSON.length > 0) {
            dailyWord = kamusDataJSON[Math.floor(Math.random() * kamusDataJSON.length)];
        }

        return res.status(200).json({
            success: true,
            isWotd: true,
            results: dailyWord ? [dailyWord] : []
        });
    }

    let results = [];

    if (source === 'supabase') {
        const { data: dbData, error } = await supabase
            .from('kamus_utama')
            .select('*')
            .or(`indonesia.ilike.%${query}%,dusun.ilike.%${query}%`)
            .limit(50);

        if (!error && dbData) {
            results = dbData;
        }
    } else {
        // Source JSON
        results = kamusDataJSON.filter(item => {
            const indonesiaMatch = item.indonesia.toLowerCase();
            const dusunMatch = item.dusun.toLowerCase();
            return indonesiaMatch.includes(query) || dusunMatch.includes(query);
        });
    }

    // Sortir hasil: yang persis sama ditaruh di atas
    results.sort((a, b) => {
        const aIndo = a.indonesia.toLowerCase();
        const aDusun = a.dusun.toLowerCase();
        const bIndo = b.indonesia?.toLowerCase() || "";
        const bDusun = b.dusun?.toLowerCase() || "";

        const aExact = aIndo === query || aDusun === query;
        const bExact = bIndo === query || bDusun === query;

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
    });

    return res.status(200).json({
        success: true,
        query: query,
        source: source,
        totalResults: results.length,
        results: results.slice(0, 50) // Batasi 50 hasil biar enteng
    });
};
