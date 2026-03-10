const { createClient } = require('@supabase/supabase-js');

// Config Supabase dari Environment (Wajib diisi di Vercel/Environment Variables)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

module.exports = async (req, res) => {
    try {
        if (req.method === 'GET') {
            const { id, slug } = req.query;

            if (id || slug) {
                let query = supabase.from('cerita_rakyat').select('*');
                if (id) query = query.eq('id', id);
                if (slug) query = query.eq('slug', slug);

                const { data, error } = await query.single();
                if (error) return res.status(404).json({ success: false, message: 'Cerita tidak ditemukan.' });
                return res.status(200).json({ success: true, data });
            }

            const { data, error } = await supabase
                .from('cerita_rakyat')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                return res.status(200).json({ success: true, data: [] });
            }
            return res.status(200).json({ success: true, data });
        }

        // POST/DELETE needs password
        const clientPass = req.headers['x-admin-password'];
        if (clientPass !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (req.method === 'POST') {
            const { title, slug, excerpt, content, image_url, category } = req.body;
            if (!title || !content) return res.status(400).json({ success: false, message: 'Judul dan Isi wajib diisi.' });

            const { data, error } = await supabase
                .from('cerita_rakyat')
                .insert([{
                    title,
                    slug,
                    excerpt,
                    content,
                    image_url,
                    category: category || 'Sejarah',
                    created_at: new Date().toISOString()
                }]);

            if (error) {
                console.error("Supabase Insert Error:", error);
                return res.status(500).json({ success: false, message: `Gagal menyimpan: ${error.message}` });
            }
            return res.status(200).json({ success: true, message: 'Berhasil menambah cerita rakyat.' });
        }

        if (req.method === 'PUT') {
            const { id, title, slug, excerpt, content, image_url, category } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'ID Cerita diperlukan untuk update.' });

            const { data, error } = await supabase
                .from('cerita_rakyat')
                .update({ title, slug, excerpt, content, image_url, category })
                .eq('id', id);

            if (error) {
                console.error("Supabase Update Error:", error);
                return res.status(500).json({ success: false, message: `Gagal memperbarui: ${error.message}` });
            }
            return res.status(200).json({ success: true, message: 'Berhasil memperbarui cerita rakyat.' });
        }

        if (req.method === 'DELETE') {
            const { id } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'ID diperlukan untuk menghapus.' });

            const { error } = await supabase
                .from('cerita_rakyat')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("Supabase Delete Error:", error);
                return res.status(500).json({ success: false, message: `Gagal menghapus: ${error.message}` });
            }
            return res.status(200).json({ success: true, message: 'Berhasil menghapus cerita.' });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    } catch (error) {
        console.error("Cerita Rakyat API Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
