const { createClient } = require('@supabase/supabase-js');
const fs = require("fs");
const path = require("path");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    const adminPassword = req.headers['x-admin-password'];

    // Auth Check
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // GET: Ambil pengetahuan manual (input admin)
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('pali_ai_knowledge')
                .select('*')
                .eq('source', 'manual')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // POST: Simpan/Timpa pengetahuan manual
    // Format yang dikirim dari dashboard biasanya: { knowledge: [{topic, content}, ...] }
    if (req.method === 'POST') {
        try {
            const { knowledge } = req.body;
            if (!knowledge || !Array.isArray(knowledge)) {
                return res.status(400).json({ success: false, message: "Knowledge array is required" });
            }

            // Hapus data manual lama lalu masukkan yang baru (Sync logic)
            // Atau bisa di-upsert satu per satu, tapi dashboard saat ini mengirim full array
            const { error: deleteError } = await supabase
                .from('pali_ai_knowledge')
                .delete()
                .eq('source', 'manual');

            if (deleteError) throw deleteError;

            const rows = knowledge.map(k => ({
                topic: k.topic,
                content: k.content,
                source: 'manual',
                updated_at: new Date().toISOString()
            }));

            if (rows.length > 0) {
                const { error: insertError } = await supabase
                    .from('pali_ai_knowledge')
                    .insert(rows);

                if (insertError) throw insertError;
            }

            return res.status(200).json({ success: true, message: "Manual knowledge fully synced with database" });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
};
