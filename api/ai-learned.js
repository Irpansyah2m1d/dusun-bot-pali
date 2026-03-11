const { createClient } = require('@supabase/supabase-js');
const fs = require("fs");
const path = require("path");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // GET: Ambil semua data (hasil belajar AI)
    if (req.method === 'GET') {
        try {
            // Ambil semua yang BUKAN manual (berarti hasil belajar chatbot/user)
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

            // Standarisasi source: Semua hasil belajar bot/user kita labeli 'chatbot' agar seragam di dashboard
            if (source === 'user-chat') source = 'chatbot';

            const normalizedTopic = topic.trim().toLowerCase();
            const now = new Date().toISOString();

            // Cek apakah topik sudah ada (upsert logic)
            const { data: existing, error: fetchError } = await supabase
                .from('pali_ai_knowledge')
                .select('*')
                .ilike('topic', normalizedTopic)
                .limit(1)
                .single();

            if (existing) {
                // Update: gabungkan konten baru ke yang ada jika belum ada
                let newContent = existing.content;
                if (!existing.content.toLowerCase().includes(content.trim().toLowerCase())) {
                    newContent += `\n\n---\n\n${content.trim()}`;
                }

                const { error: updateError } = await supabase
                    .from('pali_ai_knowledge')
                    .update({ 
                        content: newContent, 
                        updated_at: now,
                        source: source
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
                return res.status(200).json({ success: true, message: "Pengetahuan diperbarui!", data: { ...existing, content: newContent } });
            } else {
                // Tambah baru
                const { data: inserted, error: insertError } = await supabase
                    .from('pali_ai_knowledge')
                    .insert([{
                        topic: topic.trim(),
                        content: content.trim(),
                        source,
                        created_at: now,
                        updated_at: now
                    }])
                    .select();

                if (insertError) throw insertError;
                return res.status(200).json({ success: true, message: "Pengetahuan baru disimpan!", data: inserted });
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // PUT: Admin edit salah satu item (by id)
    if (req.method === 'PUT') {
        const adminPassword = req.headers['x-admin-password'];
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        try {
            const { id, topic, content } = req.body;
            if (!id) return res.status(400).json({ success: false, message: "ID wajib." });

            const { error: updateError } = await supabase
                .from('pali_ai_knowledge')
                .update({ 
                    topic: topic?.trim(), 
                    content: content?.trim(), 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', id);

            if (updateError) throw updateError;
            return res.status(200).json({ success: true, message: "Berhasil diperbarui." });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // DELETE: Admin hapus item (by id)
    if (req.method === 'DELETE') {
        const adminPassword = req.headers['x-admin-password'];
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        try {
            const { id } = req.body;
            if (!id) return res.status(400).json({ success: false, message: "ID wajib." });

            const { error: deleteError } = await supabase
                .from('pali_ai_knowledge')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
            return res.status(200).json({ success: true, message: "Berhasil dihapus." });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
};
