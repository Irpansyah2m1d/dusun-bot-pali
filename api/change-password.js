const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const authCheck = require('./_utils/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    // 1. Verify Session
    const decoded = authCheck(req);
    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Harap login kembali.' });
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Password lama dan baru wajib diisi.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
    }

    try {
        // 2. Get User from DB
        const { data: user, error } = await supabase
            .from('admin_accounts')
            .select('*')
            .eq('id', decoded.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
        }

        // 3. Verify Old Password
        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Password lama salah.' });
        }

        // 4. Hash New Password
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // 5. Update in DB
        const { error: updateError } = await supabase
            .from('admin_accounts')
            .update({ password_hash: newHash })
            .eq('id', user.id);

        if (updateError) {
            throw updateError;
        }

        return res.status(200).json({ success: true, message: 'Password berhasil diperbarui.' });

    } catch (err) {
        console.error('Change Password Error:', err);
        return res.status(500).json({ success: false, message: 'Gagal memperbarui password.' });
    }
};
