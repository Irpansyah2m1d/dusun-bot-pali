const { createClient } = require('@supabase/supabase-js');
const authCheck = require('./_utils/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // GET: Ambil semua data (hasil belajar AI)
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('pali_ai_knowledge')
                .select('*')
                .neq('source', 'manual')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // POST: Simpan atau update pengetahuan baru dari user (upsert by topic)
    if (req.method === 'POST') {
        try {
            let { topic, content, source = "chatbot" } = req.body;
            if (!topic || !content) {
                return res.status(400).json({ success: false, message: "Topic dan content wajib diisi." });
            }
            if (source === 'user-chat') source = 'chatbot';
            const normalizedTopic = topic.trim().toLowerCase();
            const now = new Date().toISOString();

            const { data: existing } = await supabase
                .from('pali_ai_knowledge')
                .select('*')
                .ilike('topic', normalizedTopic)
                .limit(1)
                .single();

            if (existing) {
                let newContent = existing.content;
                if (!existing.content.toLowerCase().includes(content.trim().toLowerCase())) {
                    newContent += `\n\n---\n\n${content.trim()}`;
                }
                await supabase.from('pali_ai_knowledge').update({ content: newContent, updated_at: now, source }).eq('id', existing.id);
                return res.status(200).json({ success: true, message: "Pengetahuan diperbarui!" });
            } else {
                await supabase.from('pali_ai_knowledge').insert([{ topic: topic.trim(), content: content.trim(), source, updated_at: now }]);
                return res.status(200).json({ success: true, message: "Pengetahuan baru disimpan!" });
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // PUT: Admin edit salah satu item (by id)
    if (req.method === 'PUT') {
        const decoded = authCheck(req);
        if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized." });

        try {
            const { id, topic, content } = req.body;
            await supabase.from('pali_ai_knowledge').update({ topic, content, updated_at: new Date().toISOString() }).eq('id', id);
            return res.status(200).json({ success: true, message: "Berhasil diperbarui." });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // DELETE: Admin hapus item (by id)
    if (req.method === 'DELETE') {
        const decoded = authCheck(req);
        if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized." });

        try {
            const { id } = req.body;
            await supabase.from('pali_ai_knowledge').delete().eq('id', id);
            return res.status(200).json({ success: true, message: "Berhasil dihapus." });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
};
