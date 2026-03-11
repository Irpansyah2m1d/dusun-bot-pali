const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
    try {
        const { data, error } = await supabase.from('pali_ai_knowledge').select('*');
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('Count:', data.length);
            if (data.length > 0) console.log('Sample:', data[0]);
        }
    } catch (e) {
        console.error('Catch:', e.message);
    }
}
test();
