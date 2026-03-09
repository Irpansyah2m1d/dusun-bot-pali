const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Config Supabase
const supabaseUrl = 'https://attspecehfhixbdfnnvn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0dHNwZWNlaGZoaXhiZGZubnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjIxMzQsImV4cCI6MjA4ODU5ODEzNH0.o3HQjQaE69i9_BnOKjOgefstaFOchZJNZkwOd2JAroA';
const supabase = createClient(supabaseUrl, supabaseKey);

// Custom Header Password for very simple security overlay
const ADMIN_PASSWORD = "irpansyahpali";

module.exports = async (req, res) => {
    // Verifikasi password admin terlebih dahulu
    const clientPass = req.headers['x-admin-password'];

    if (clientPass !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Password salah.' });
    }

    try {
        if (req.method === 'GET') {
            // Ambil semua data usulan
            const { data, error } = await supabase
                .from('usulan_kosakata')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                return res.status(500).json({ success: false, message: 'Gagal mengambil data dari Supabase.' });
            }

            return res.status(200).json({ success: true, data });

        } else if (req.method === 'DELETE') {
            // Hapus data usulan berdasarkan ID
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, message: 'ID diperlukan untuk menghapus.' });
            }

            const { error } = await supabase
                .from('usulan_kosakata')
                .delete()
                .eq('id', id);

            if (error) {
                return res.status(500).json({ success: false, message: 'Gagal menghapus data di Supabase.' });
            }

            return res.status(200).json({ success: true, message: 'Berhasil menghapus usulan.' });

        } else if (req.method === 'POST') {
            const { action, payload } = req.body;

            if (action === 'PURGE_ALL') {
                const { error } = await supabase.from('usulan_kosakata').delete().neq('id', 0);
                if (error) return res.status(500).json({ success: false, message: 'Gagal menghapus semua usulan.' });
                return res.status(200).json({ success: true, message: 'Semua usulan telah di-clear.' });
            }

            if (action === 'MIGRATE_KAMUS') {
                // Ambil isi File json
                const kamusPath = path.join(process.cwd(), 'data', 'kamus.json');
                if (!fs.existsSync(kamusPath)) {
                    return res.status(404).json({ success: false, message: 'File kamus.json tidak ditemukan!' });
                }
                const kamusData = JSON.parse(fs.readFileSync(kamusPath, 'utf8'));
                // Insert ke supabase kamus_utama
                const { error } = await supabase.from('kamus_utama').insert(kamusData).select();
                if (error) {
                    return res.status(500).json({ success: false, message: 'Gagal migrasi ke Supabase.', error: error.message });
                }
                return res.status(200).json({ success: true, message: `Berhasil migrasi ${kamusData.length} kosa kata ke Supabase!` });
            }

            if (action === 'APPROVE_USULAN') {
                // Pindah table: dari usulan_kosakata ke kamus_utama
                const { id, indonesia, dusun, contoh_id, contoh_dusun } = payload;
                const { error: insertError } = await supabase.from('kamus_utama').insert([
                    { indonesia, dusun, contoh_id, contoh_dusun }
                ]);
                if (insertError) return res.status(500).json({ success: false, message: 'Gagal menambah ke kamus_utama.' });

                // Delete dari usulan
                await supabase.from('usulan_kosakata').delete().eq('id', id);
                return res.status(200).json({ success: true, message: 'Kosa kata di-Approve dan masuk ke kamus_utama!' });
            }

            if (action === 'EDIT_USULAN') {
                const { id, indonesia, dusun, contoh_id, contoh_dusun } = payload;
                const { error } = await supabase.from('usulan_kosakata').update({
                    indonesia, dusun, contoh_id, contoh_dusun
                }).eq('id', id);

                if (error) return res.status(500).json({ success: false, message: 'Gagal mengupdate usulan.' });
                return res.status(200).json({ success: true, message: 'Berhasil update data usulan!' });
            }
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    } catch (error) {
        console.error("Server Error (Admin):", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
