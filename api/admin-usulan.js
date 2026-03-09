const { createClient } = require('@supabase/supabase-js');

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
            // Jika POST dengan flag purgeAll, itu artinya kita convert ke JSON & mau hapus semua jika sukses
            const { action } = req.body;
            if (action === 'PURGE_ALL') {
                // Untuk fitur ini kita tinggalkan karena bisa delete 1-1 dulu atau query bulk
                const { error } = await supabase
                    .from('usulan_kosakata')
                    .delete()
                    .neq('id', 0); // Menghapus semua

                if (error) {
                    return res.status(500).json({ success: false, message: 'Gagal menghapus semua usulan.' });
                }
                return res.status(200).json({ success: true, message: 'Semua usulan telah di-clear.' });
            }
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    } catch (error) {
        console.error("Server Error (Admin):", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
