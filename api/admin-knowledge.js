const fs = require("fs");
const path = require("path");

const knowledgePath = path.join(process.cwd(), "data", "knowledge.json");

module.exports = async (req, res) => {
    const adminPassword = req.headers['x-admin-password'];

    // Auth Check
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (req.method === 'GET') {
        try {
            if (!fs.existsSync(knowledgePath)) {
                return res.status(200).json({ success: true, data: [] });
            }
            const data = fs.readFileSync(knowledgePath, "utf-8");
            return res.status(200).json({ success: true, data: JSON.parse(data) });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { knowledge } = req.body;
            if (!knowledge) {
                return res.status(400).json({ success: false, message: "Knowledge data is required" });
            }

            // Ensure directory exists
            const dir = path.dirname(knowledgePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2), "utf-8");
            return res.status(200).json({ success: true, message: "Knowledge updated successfully" });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
};
