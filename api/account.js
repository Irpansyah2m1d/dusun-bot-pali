const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authCheck = require('./_utils/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const jwtSecret = process.env.JWT_SECRET || 'super-secret-key-change-this'; 
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // 1. Handle Login (POST /api/auth)
    if (req.method === 'POST' && req.query.action === 'login') {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: 'Username & Password wajib diisi.' });

        const { data: user, error } = await supabase.from('admin_accounts').select('*').eq('username', username).single();
        if (error || !user) return res.status(401).json({ success: false, message: 'Username atau password salah.' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Username atau password salah.' });

        const token = jwt.sign({ id: user.id, username: user.username, role: 'admin' }, jwtSecret, { expiresIn: '24h' });
        await supabase.from('admin_accounts').update({ last_login: new Date().toISOString() }).eq('id', user.id);

        return res.status(200).json({
            success: true,
            token,
            user: { username: user.username, full_name: user.full_name }
        });
    }

    // 2. Handle Change Password (POST /api/change-password)
    if (req.method === 'POST' && req.query.action === 'change-password') {
        const decoded = authCheck(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Unauthorized. Harap login kembali.' });

        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) return res.status(400).json({ success: false, message: 'Password lama dan baru wajib diisi.' });

        const { data: user, error } = await supabase.from('admin_accounts').select('*').eq('id', decoded.id).single();
        if (error || !user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Password lama salah.' });

        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        const { error: updateError } = await supabase.from('admin_accounts').update({ password_hash: hashedNewPassword }).eq('id', decoded.id);
        if (updateError) return res.status(500).json({ success: false, message: 'Gagal memperbarui password.' });

        return res.status(200).json({ success: true, message: 'Password berhasil diperbarui.' });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
