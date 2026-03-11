const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testWOTD() {
    try {
        console.log("Testing Supabase connectivity...");
        const { count, error: countErr } = await supabase
            .from('kamus_utama')
            .select('*', { count: 'exact', head: true });

        if (countErr) {
            console.error("Count Error:", countErr);
        } else {
            console.log("Count:", count);
            const randomIndex = Math.floor(Math.random() * count);
            const { data: dbData, error: dbErr } = await supabase
                .from('kamus_utama')
                .select('*')
                .range(randomIndex, randomIndex)
                .single();
            
            if (dbErr) {
                console.error("Single Error:", dbErr);
            } else {
                console.log("Word:", dbData);
            }
        }
    } catch (e) {
        console.error("Crash:", e);
    }
}

testWOTD();
