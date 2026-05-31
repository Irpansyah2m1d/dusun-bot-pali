const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = async (req, res) => {
    if (!supabase) {
        return res.status(200).json({ success: false, message: 'Database not configured' });
    }

    if (req.method === 'GET') {
        try {
            // Fetch top 30 leaderboard
            // The metadata will contain: { name, wpm, accuracy }
            // We order by metadata->wpm (desc) then metadata->accuracy (desc)
            // Supabase/PostgreSQL doesn't easily order by JSON fields in a simple select query unless using a view or raw SQL,
            // so we will fetch the top 100 or all typing results and sort them in JS for simplicity, 
            // since this is a lightweight app.
            
            const { data: results, error } = await supabase
                .from('app_analytics')
                .select('metadata, created_at')
                .eq('event_type', 'typing_result')
                .order('created_at', { ascending: false })
                .limit(500); // Fetch recent ones to sort

            if (error) console.error("Leaderboard Error:", error);

            let leaderboard = [];
            if (results) {
                // Parse and sort in JS to ensure accurate sorting by WPM and Accuracy
                leaderboard = results.map(item => ({
                    name: item.metadata.name || 'Anonim',
                    wpm: item.metadata.wpm || 0,
                    accuracy: item.metadata.accuracy || 0,
                    created_at: item.created_at
                }));

                // Sort: WPM descending, then Accuracy descending
                leaderboard.sort((a, b) => {
                    if (b.wpm !== a.wpm) {
                        return b.wpm - a.wpm;
                    }
                    return b.accuracy - a.accuracy;
                });

                // Get top 30
                leaderboard = leaderboard.slice(0, 30);
            }

            return res.status(200).json({
                success: true,
                leaderboard: leaderboard
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { action, metadata } = req.body;
            
            if (action === 'save_score') {
                // Ensure name is clean
                let cleanName = metadata.name ? metadata.name.replace(/[<>]/g, '').trim() : 'Anonim';
                if (!cleanName) cleanName = 'Anonim';

                await supabase.from('app_analytics').insert([{
                    event_type: 'typing_result',
                    query: 'score',
                    metadata: {
                        name: cleanName,
                        wpm: metadata.wpm || 0,
                        accuracy: metadata.accuracy || 0
                    },
                    created_at: new Date().toISOString()
                }]);
            }

            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
};
