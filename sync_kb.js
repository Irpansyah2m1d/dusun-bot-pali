const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function sync() {
    const knowledgePath = path.join(__dirname, 'data', 'knowledge.json');
    if (!fs.existsSync(knowledgePath)) {
        console.log('No knowledge.json found.');
        return;
    }

    const localData = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
    console.log(`Syncing ${localData.length} items to database...`);

    // Clear existing manual data
    const { error: delError } = await supabase.from('pali_ai_knowledge').delete().eq('source', 'manual');
    if (delError) {
        console.error('Delete Error:', delError.message);
        return;
    }

    // Insert new data
    const insertData = localData.map(item => ({
        topic: item.topic.trim(),
        content: item.content.trim(),
        source: 'manual',
        updated_at: new Date().toISOString()
    }));

    const { error: insError } = await supabase.from('pali_ai_knowledge').insert(insertData);
    if (insError) {
        console.error('Insert Error:', insError.message);
    } else {
        console.log('Sync complete! Database now matches knowledge.json.');
    }
}
sync();
