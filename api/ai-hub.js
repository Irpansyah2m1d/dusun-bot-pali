const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const authCheck = require('./_utils/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    const { type } = req.query;

    // 1. Admin Knowledge (Manual Tanam)
    if (type === 'knowledge') {
        const decoded = authCheck(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Unauthorized.' });

        if (req.method === 'GET') {
            const knowledgePath = path.join(process.cwd(), 'data', 'knowledge.json');
            let knowledgeData = [];
            if (fs.existsSync(knowledgePath)) knowledgeData = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
            return res.status(200).json({ success: true, data: knowledgeData });
        }

        if (req.method === 'POST') {
            const { knowledge } = req.body;
            if (!Array.isArray(knowledge)) return res.status(400).json({ success: false, message: 'Format invalid.' });
            const knowledgePath = path.join(process.cwd(), 'data', 'knowledge.json');
            fs.writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2));
            return res.status(200).json({ success: true, message: 'Berhasil update knowledge base.' });
        }
    }

    // 2. AI Learned (Hasil Belajar)
    if (type === 'learned') {
        if (req.method === 'GET') {
            const { data, error } = await supabase.from('ai_learned').select('*').order('updated_at', { ascending: false });
            if (error) return res.status(200).json({ success: true, data: [] });
            return res.status(200).json({ success: true, data });
        }

        // POST for Chatbot learning (Public)
        if (req.method === 'POST') {
            const { topic, content, source = 'user' } = req.body;
            if (!topic || !content) return res.status(400).json({ success: false, message: 'Data incomplete.' });
            const { error } = await supabase.from('ai_learned').upsert({ topic: topic.trim(), content: content.trim(), source, updated_at: new Date().toISOString() }, { onConflict: 'topic' });
            if (error) throw error;
            return res.status(200).json({ success: true, message: 'Thank you for teaching me.' });
        }

        // PUT/DELETE (Admin Only)
        const decoded = authCheck(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Unauthorized.' });

        if (req.method === 'PUT') {
            const { id, topic, content } = req.body;
            const { error } = await supabase.from('ai_learned').update({ topic, content, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (req.method === 'DELETE') {
            const { id } = req.body;
            const { error } = await supabase.from('ai_learned').delete().eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
