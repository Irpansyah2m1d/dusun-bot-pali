const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
    try {
        const { data, error } = await supabase.from('ai_learned').select('*');
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('Count:', data.length);
            if (data.length > 0) {
                console.log('Sample IDs:', data.map(d => d.id));
                console.log('Sample Sources:', data.map(d => d.source));
                console.log('Full First Record:', JSON.stringify(data[0], null, 2));
            }
        }
    } catch (e) {
        console.error('Catch:', e.message);
    }
}
test();
