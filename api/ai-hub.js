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
            const { data, error } = await supabase.from('pali_ai_knowledge').select('*').order('id', { ascending: true });
            if (error) return res.status(200).json({ success: true, data: [] });
            return res.status(200).json({ success: true, data });
        }

        if (req.method === 'POST') {
            const { knowledge } = req.body;
            if (!Array.isArray(knowledge)) return res.status(400).json({ success: false, message: 'Format invalid.' });
            
            try {
                // Delete existing manual entries to handle deletions properly
                await supabase.from('pali_ai_knowledge').delete().eq('source', 'manual');

                // Bulk insert the new list
                if (knowledge.length > 0) {
                    const insertData = knowledge.map(item => ({
                        topic: item.topic.trim(),
                        content: item.content.trim(),
                        source: 'manual',
                        updated_at: new Date().toISOString()
                    }));
                    const { error } = await supabase.from('pali_ai_knowledge').insert(insertData);
                    if (error) throw error;
                }
                
                return res.status(200).json({ success: true, message: 'Berhasil update knowledge base di database.' });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
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
