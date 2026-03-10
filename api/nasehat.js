const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = async (req, res) => {
    try {
        if (req.method === 'GET') {
            const { id } = req.query;
            let data = [];

            if (supabase) {
                const query = supabase.from('nasehat_dusun').select('*');
                if (id) query.eq('id', id);

                const { data: dbData, error } = await query.order('id', { ascending: false });
                if (!error && dbData) {
                    data = dbData;
                }
            }

            // Fallback to local JSON if DB fails or empty
            if (data.length === 0) {
                const nasehatPath = path.join(process.cwd(), 'data', 'nasehat.json');
                if (fs.existsSync(nasehatPath)) {
                    data = JSON.parse(fs.readFileSync(nasehatPath, 'utf8'));
                }
            }

            return res.status(200).json({ success: true, data });
        }

        // POST/PUT/DELETE Requires Admin Password
        const clientPass = req.headers['x-admin-password'];
        if (clientPass !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (req.method === 'POST') {
            const { text, meaning } = req.body;
            if (!text || !meaning) return res.status(400).json({ success: false, message: 'Teks dan arti wajib diisi.' });

            const { error } = await supabase
                .from('nasehat_dusun')
                .insert([{ text, meaning }]);

            if (error) throw error;
            return res.status(200).json({ success: true, message: 'Nasehat berhasil ditambahkan.' });
        }

        if (req.method === 'PUT') {
            const { id, text, meaning } = req.body;
            if (!id || !text || !meaning) return res.status(400).json({ success: false, message: 'Data belum lengkap.' });

            const { error } = await supabase
                .from('nasehat_dusun')
                .update({ text, meaning })
                .eq('id', id);

            if (error) throw error;
            return res.status(200).json({ success: true, message: 'Nasehat berhasil diupdate.' });
        }

        if (req.method === 'DELETE') {
            const { id } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'ID diperlukan.' });

            const { error } = await supabase
                .from('nasehat_dusun')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.status(200).json({ success: true, message: 'Nasehat berhasil dihapus.' });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error("Nasehat API Error:", error);
        return res.status(500).json({ success: false, message: error.message || 'Terjadi kesalahan sistem.' });
    }
};
