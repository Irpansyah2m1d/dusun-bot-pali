const fs = require('fs');
const path = require('path');

// Setup file paths
const kamusPath = path.join(process.cwd(), 'data', 'kamus.json');
const usulanPath = path.join(process.cwd(), 'data', 'usulan_kosakata.json');

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

        // 1. Cek apakah kata sudah ada di kamus.json
        let kamusData = [];
        if (fs.existsSync(kamusPath)) {
            kamusData = JSON.parse(fs.readFileSync(kamusPath, 'utf-8'));
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

        // 2. Baca file usulan_kosakata.json
        let usulanData = [];
        if (fs.existsSync(usulanPath)) {
            try {
                usulanData = JSON.parse(fs.readFileSync(usulanPath, 'utf-8'));
            } catch (e) {
                usulanData = [];
            }
        }

        // 3. Masukkan data dengan format pengelompokan berdasarkan "nama"
        const newKata = {
            indonesia: indonesia.trim(),
            dusun: dusun.trim(),
            contoh_id: (contoh_id || "").trim(),
            contoh_dusun: (contoh_dusun || "").trim()
        };

        const userIndex = usulanData.findIndex(item => item.nama.toLowerCase() === nama.toLowerCase().trim());

        if (userIndex !== -1) {
            // Cek apakah sudah ada di usulan
            const alreadyInUsulan = usulanData[userIndex].kosakata.some(item =>
                item.indonesia.toLowerCase() === queryIndo ||
                item.dusun.toLowerCase() === queryDusun
            );

            if (alreadyInUsulan) {
                return res.status(400).json({
                    success: false,
                    message: 'Kosakata ini sudah pernah Anda atau orang lain usulkan.'
                });
            }

            // Tambahkan ke array kosakata milik user tersebut
            usulanData[userIndex].kosakata.push(newKata);
        } else {
            // Buat entri baru untuk user ini
            usulanData.push({
                nama: nama.trim(),
                kosakata: [newKata]
            });
        }

        // 4. Simpan kembali ke file usulan_kosakata.json
        fs.writeFileSync(usulanPath, JSON.stringify(usulanData, null, 2));

        return res.status(200).json({
            success: true,
            message: 'Berhasil mengusulkan kosakata baru! Terima kasih.'
        });

    } catch (error) {
        console.error("Local Server Error (Usulan):", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
