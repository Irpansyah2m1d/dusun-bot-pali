const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ dest: 'tmp/uploads/' });

module.exports = async (req, res) => {
    upload.single('audio')(req, res, async (err) => {
        if (err) return res.status(500).json({ success: false, message: "Upload error" });

        const adminPassword = req.headers['x-admin-password'];
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No audio file uploaded" });
        }

        try {
            const fileBuffer = fs.readFileSync(req.file.path);
            const mimeType = req.file.mimetype || 'audio/mpeg';
            const ext = mimeType.includes('webm') ? 'webm' : 'mp3';
            const fileName = `audio_${Date.now()}.${ext}`;

            // Upload to Supabase Storage Bucket 'audio-kamus'
            const { data, error } = await supabase.storage
                .from('audio-kamus')
                .upload(fileName, fileBuffer, {
                    contentType: mimeType,
                    upsert: true
                });

            if (error) {
                if (error.message.includes('not found')) {
                    throw new Error("Bucket 'audio-kamus' belum dibuat di Supabase Storage. Silakan buat bucket tersebut dan atur ke 'Public'.");
                }
                throw error;
            }

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('audio-kamus')
                .getPublicUrl(fileName);

            // Clean up
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

            return res.status(200).json({ success: true, audio_url: publicUrl });

        } catch (error) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(500).json({ success: false, message: error.message });
        }
    });
};
