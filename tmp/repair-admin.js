const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function repairAdmin() {
    console.log("🛠️  Sedang memperbaiki akun admin...");
    
    // Password target: password123
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    
    // Update atau Insert (Upsert) data admin
    const { data, error } = await supabase
        .from('admin_accounts')
        .upsert({
            username: 'admin',
            password_hash: hash,
            full_name: 'Administrator',
            created_at: new Date().toISOString()
        }, { onConflict: 'username' });

    if (error) {
        console.error("❌ Gagal memperbaiki akun admin:", error.message);
    } else {
        console.log("✅ Akun admin berhasil diperbarui.");
        console.log("   Username: admin");
        console.log("   Password: password123");
        console.log("\n🚀 Silakan coba login kembali di dashboard.");
    }
}

repairAdmin();
