const fs = require("fs");
const path = require("path");

const learnedPath = path.join(process.cwd(), "data", "ai-learned.json");

function readLearned() {
    try {
        if (fs.existsSync(learnedPath)) {
            return JSON.parse(fs.readFileSync(learnedPath, "utf-8"));
        }
    } catch (e) { }
    return [];
}

function writeLearned(data) {
    const dir = path.dirname(learnedPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(learnedPath, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = async (req, res) => {
    // GET: Ambil semua data (publik untuk AI context, atau admin)
    if (req.method === 'GET') {
        try {
            const data = readLearned();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // POST: Simpan atau update pengetahuan baru dari user (upsert by topic)
    if (req.method === 'POST') {
        try {
            const { topic, content, source = "user" } = req.body;
            if (!topic || !content) {
                return res.status(400).json({ success: false, message: "Topic dan content wajib diisi." });
            }

            const data = readLearned();
            const normalizedTopic = topic.trim().toLowerCase();

            // Cari apakah topik sudah ada (upsert)
            const existingIdx = data.findIndex(
                item => item.topic.trim().toLowerCase() === normalizedTopic
            );

            const now = new Date().toISOString();

            if (existingIdx !== -1) {
                // Update: tambahkan konten baru ke yang ada (gabung, tidak timpa)
                const existing = data[existingIdx];
                // Cek apakah konten baru belum ada di konten lama
                if (!existing.content.toLowerCase().includes(content.trim().toLowerCase())) {
                    existing.content += `\n\n---\n\n${content.trim()}`;
                }
                existing.updated_at = now;
                existing.source = source;
                data[existingIdx] = existing;
            } else {
                // Tambah baru
                data.push({
                    id: Date.now(),
                    topic: topic.trim(),
                    content: content.trim(),
                    source,
                    is_ai_learned: true, // Penanda khusus: hasil belajar AI
                    created_at: now,
                    updated_at: now
                });
            }

            writeLearned(data);
            return res.status(200).json({ success: true, message: "Pengetahuan berhasil disimpan!", data: data });
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

            const data = readLearned();
            const idx = data.findIndex(item => item.id === id);
            if (idx === -1) return res.status(404).json({ success: false, message: "Data tidak ditemukan." });

            if (topic) data[idx].topic = topic.trim();
            if (content) data[idx].content = content.trim();
            data[idx].updated_at = new Date().toISOString();

            writeLearned(data);
            return res.status(200).json({ success: true, message: "Berhasil diperbarui.", data: data[idx] });
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

            let data = readLearned();
            data = data.filter(item => item.id !== id);

            writeLearned(data);
            return res.status(200).json({ success: true, message: "Berhasil dihapus." });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
};
