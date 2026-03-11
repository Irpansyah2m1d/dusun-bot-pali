const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const authCheck = require('./_utils/auth');

// Config Supabase dari Environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // Verifikasi Auth via JWT
    const decoded = authCheck(req);
    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Harap login kembali. Sesi habis atau tidak valid.' });
    }

    try {
        if (req.method === 'GET') {
            const { type } = req.query;

            if (type === 'settings') {
                const { data } = await supabase.from('app_settings').select('key_value').eq('key_name', 'data_source').single();
                return res.status(200).json({ success: true, source: data ? data.key_value : 'json' });
            }

            if (type === 'kamus') {
                const { data, error } = await supabase
                    .from('kamus_utama')
                    .select('*')
                    .order('indonesia', { ascending: true });

                if (error) {
                    return res.status(500).json({ success: false, message: 'Gagal mengambil data kamus dari Supabase.' });
                }
                return res.status(200).json({ success: true, data });
            }

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
            const { action, payload, key, value } = req.body;

            if (action === 'PURGE_ALL') {
                const { error } = await supabase.from('usulan_kosakata').delete().neq('id', 0);
                if (error) return res.status(500).json({ success: false, message: 'Gagal menghapus semua usulan.' });
                return res.status(200).json({ success: true, message: 'Semua usulan telah di-clear.' });
            }

            // Combined handler for source toggle / settings update
            if (action === 'TOGGLE_SOURCE' || action === 'UPDATE_SETTING') {
                const finalKey = key || 'data_source';
                const finalValue = value || (payload ? payload.source : null);

                if (!finalValue) return res.status(400).json({ success: false, message: 'Value diperlukan.' });

                const { error } = await supabase.from('app_settings').upsert({ key_name: finalKey, key_value: finalValue });
                if (error) return res.status(500).json({ success: false, message: 'Gagal mengubah pengaturan! Pastikan tabel app_settings sudah benar.' });
                return res.status(200).json({ success: true, message: `Pengaturan ${finalKey} berhasil diperbarui.` });
            }

            if (action === 'MIGRATE_KAMUS') {
                const kamusPath = path.join(process.cwd(), 'data', 'kamus.json');
                if (!fs.existsSync(kamusPath)) {
                    return res.status(404).json({ success: false, message: 'File kamus.json tidak ditemukan!' });
                }
                const kamusData = JSON.parse(fs.readFileSync(kamusPath, 'utf8'));

                // Clear old kamus_utama first
                await supabase.from('kamus_utama').delete().not('id', 'is', null);

                const { error } = await supabase.from('kamus_utama').insert(kamusData).select();
                if (error) {
                    return res.status(500).json({ success: false, message: 'Gagal migrasi ke Supabase.', error: error.message });
                }
                return res.status(200).json({ success: true, message: `Berhasil hapus tabel & migrasi ulang ${kamusData.length} kosa kata ke Supabase!` });
            }

            if (action === 'IMPORT_JSON') {
                const { jsonData } = payload;
                if (!Array.isArray(jsonData)) return res.status(400).json({ success: false, message: 'Format JSON invalid.' });

                const { error } = await supabase.from('kamus_utama').insert(jsonData).select();
                if (error) {
                    return res.status(500).json({ success: false, message: 'Gagal import ke Supabase.', error: error.message });
                }
                return res.status(200).json({ success: true, message: `Berhasil import ${jsonData.length} kosa kata!` });
            }

            if (action === 'APPROVE_USULAN') {
                const { id, indonesia, dusun, contoh_id, contoh_dusun } = payload;
                const { error: insertError } = await supabase.from('kamus_utama').insert([
                    { indonesia, dusun, contoh_id, contoh_dusun }
                ]);
                if (insertError) return res.status(500).json({ success: false, message: 'Gagal menambah ke kamus_utama.' });

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

            if (action === 'DELETE_KAMUS_ITEM') {
                const { id } = payload;
                if (!id) return res.status(400).json({ success: false, message: 'ID diperlukan.' });

                const { error } = await supabase.from('kamus_utama').delete().eq('id', id);
                if (error) return res.status(500).json({ success: false, message: 'Gagal menghapus kosa kata.' });
                return res.status(200).json({ success: true, message: 'Kosa kata berhasil dihapus.' });
            }

            if (action === 'UPDATE_KAMUS_ITEM') {
                if (!payload) return res.status(400).json({ success: false, message: 'Payload needed.' });
                const { id, indonesia, dusun, contoh_id, contoh_dusun, audio_url } = payload;
                if (!id) return res.status(400).json({ success: false, message: 'ID (ID kosa kata) wajib ada untuk update.' });

                const { error: updateError } = await supabase
                    .from('kamus_utama')
                    .update({ 
                        indonesia: indonesia?.trim(), 
                        dusun: dusun?.trim(), 
                        contoh_id: contoh_id?.trim(), 
                        contoh_dusun: contoh_dusun?.trim(), 
                        audio_url: audio_url 
                    })
                    .eq('id', id);

                if (updateError) {
                    console.error("Supabase Update Error:", updateError);
                    return res.status(500).json({ success: false, message: 'Database error: ' + updateError.message });
                }
                
                return res.status(200).json({ success: true, message: 'Berhasil update kosa kata!' });
            }

            if (action === 'ADD_KAMUS_ITEM') {
                const { indonesia, dusun, contoh_id, contoh_dusun, audio_url } = payload;
                const { error } = await supabase.from('kamus_utama').insert([
                    { indonesia, dusun, contoh_id, contoh_dusun, audio_url }
                ]);

                if (error) return res.status(500).json({ success: false, message: 'Gagal menambah kosa kata.' });
                return res.status(200).json({ success: true, message: 'Berhasil menambah kosa kata!' });
            }

            return res.status(400).json({ success: false, message: `Action ${action} tidak dikenali.` });
        }

        return res.status(405).json({ success: false, message: `Method ${req.method} tidak diizinkan di endpoint ini.` });

    } catch (error) {
        console.error("Server Error (Admin):", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
