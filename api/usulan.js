const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// URL dan API Key Supabase dari Environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Path ke kamus (untuk validasi awal agar tidak double)
const kamusPath = path.join(process.cwd(), 'data', 'kamus.json');

module.exports = async (req, res) => {
    // Hanya menerima POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { nama, indonesia, dusun, contoh_id, contoh_dusun } = req.body;

        if (!nama || !indonesia || !dusun) {
            return res.status(400).json({
                success: false,
                message: 'Nama, kata Indonesia, dan kata Dusun wajib diisi.'
            });
        }

        const queryIndo = indonesia.toLowerCase().trim();
        const queryDusun = dusun.toLowerCase().trim();

        // 1. Cek apakah kata sudah ada di kamus.json utama
        let kamusData = [];
        if (fs.existsSync(kamusPath)) {
            try {
                kamusData = JSON.parse(fs.readFileSync(kamusPath, 'utf-8'));
            } catch (e) {
                // Ignore error if kamus doesn't exist
            }
        }

        const alreadyExists = kamusData.some(item =>
            item.indonesia.toLowerCase() === queryIndo ||
            item.dusun.toLowerCase() === queryDusun
        );

        if (alreadyExists) {
            return res.status(400).json({
                success: false,
                message: 'Kosakata ini sudah ada di dalam kamus utama.'
            });
        }

        // 2. Cek apakah kata sudah pernah diusulkan di database Supabase
        const { data: existingData, error: dbQueryError } = await supabase
            .from('usulan_kosakata')
            .select('id')
            .or(`indonesia.ilike.${queryIndo},dusun.ilike.${queryDusun}`);

        if (dbQueryError) {
            console.error('Error querying Supabase:', dbQueryError);
            return res.status(500).json({
                success: false,
                message: 'Database tidak merespon saat verifikasi usulan lama.'
            });
        }

        if (existingData && existingData.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Kosakata ini sudah pernah Anda atau orang lain usulkan sebelumnya.'
            });
        }

        // 3. Masukkan data ke Database Supabase
        const { error: insertError } = await supabase
            .from('usulan_kosakata')
            .insert([
                {
                    nama: nama.trim(),
                    indonesia: indonesia.trim(),
                    dusun: dusun.trim(),
                    contoh_id: (contoh_id || "").trim(),
                    contoh_dusun: (contoh_dusun || "").trim()
                }
            ]);

        if (insertError) {
            console.error('Error inserting to Supabase:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Gagal menyimpan kosakata ke database.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Berhasil mengusulkan kosakata baru! Terima kasih.'
        });

    } catch (error) {
        console.error("Server Error (Usulan):", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
