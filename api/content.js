const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const authCheck = require('./_utils/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    const { type } = req.query;

    // 1. Contributors (Public GET)
    if (type === 'contributors' && req.method === 'GET') {
        return res.status(200).json({
            success: true,
            data: [
                { name: "Irpansyah", count: 400 },
                { name: "Abri", count: 57 },
                { name: "Teguh", count: 30 },
                { name: "Rian Hidayat", count: 20 }
            ]
        });
    }

    // 2. Cerita Rakyat
    if (type === 'cerita-rakyat') {
        if (req.method === 'GET') {
            const { id, slug } = req.query;
            let query = supabase.from('cerita_rakyat').select('*');
            if (id) query = query.eq('id', id);
            if (slug) query = query.eq('slug', slug);

            const { data, error } = await (id || slug ? query.single() : query.order('created_at', { ascending: false }));
            if (error) return res.status(id || slug ? 404 : 200).json({ success: false, message: 'Data tidak ditemukan.', data: [] });
            return res.status(200).json({ success: true, data: data || [] });
        }

        // POST/PUT/DELETE for Cerita Rakyat
        const decoded = authCheck(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Unauthorized.' });

        if (req.method === 'POST') {
            const { title, slug, excerpt, content, image_url, category, penulis, instagram, asal } = req.body;
            const { error } = await supabase.from('cerita_rakyat').insert([{ title, slug, excerpt, content, image_url, category: category || 'Sejarah', penulis, instagram, asal, created_at: new Date().toISOString() }]);
            if (error) return res.status(500).json({ success: false, message: error.message });
            return res.status(200).json({ success: true, message: 'Berhasil menambah.' });
        }

        if (req.method === 'PUT') {
            const { id, title, slug, excerpt, content, image_url, category, penulis, instagram, asal } = req.body;
            const { error } = await supabase.from('cerita_rakyat').update({ title, slug, excerpt, content, image_url, category, penulis, instagram, asal }).eq('id', id);
            if (error) return res.status(500).json({ success: false, message: error.message });
            return res.status(200).json({ success: true, message: 'Berhasil update.' });
        }

        if (req.method === 'DELETE') {
            const { id } = req.body;
            const { error } = await supabase.from('cerita_rakyat').delete().eq('id', id);
            if (error) return res.status(500).json({ success: false, message: error.message });
            return res.status(200).json({ success: true, message: 'Berhasil hapus.' });
        }
    }

    // 3. Nasehat Dusun
    if (type === 'nasehat') {
        if (req.method === 'GET') {
            const { id } = req.query;
            let query = supabase.from('nasehat_dusun').select('*');
            if (id) query = query.eq('id', id);

            const { data: dbData, error: dbError } = await query.order('id', { ascending: false });
            if (!dbError && dbData && dbData.length > 0) return res.status(200).json({ success: true, data: dbData });

            const nasehatPath = path.join(process.cwd(), 'data', 'nasehat.json');
            let fallbackData = [];
            if (fs.existsSync(nasehatPath)) fallbackData = JSON.parse(fs.readFileSync(nasehatPath, 'utf8'));
            return res.status(200).json({ success: true, data: fallbackData });
        }

        const decoded = authCheck(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Unauthorized.' });

        if (req.method === 'POST') {
            const { text, meaning } = req.body;
            const { error } = await supabase.from('nasehat_dusun').insert([{ text, meaning }]);
            if (error) return res.status(500).json({ success: false, message: error.message });
            return res.status(200).json({ success: true, message: 'Berhasil menambah.' });
        }

        if (req.method === 'PUT') {
            const { id, text, meaning } = req.body;
            const { error } = await supabase.from('nasehat_dusun').update({ text, meaning }).eq('id', id);
            if (error) return res.status(500).json({ success: false, message: error.message });
            return res.status(200).json({ success: true, message: 'Berhasil update.' });
        }

        if (req.method === 'DELETE') {
            const { id } = req.body;
            const { error } = await supabase.from('nasehat_dusun').delete().eq('id', id);
            if (error) return res.status(500).json({ success: false, message: error.message });
            return res.status(200).json({ success: true, message: 'Berhasil hapus.' });
        }
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
