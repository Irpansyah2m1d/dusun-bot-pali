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
            // Count attempts
            const { count, error: countError } = await supabase
                .from('app_analytics')
                .select('*', { count: 'exact', head: true })
                .eq('event_type', 'kuis_attempt');

            if (countError) console.error("Count Error:", countError);

            // Fetch latest reviews
            const { data: reviews, error: reviewsError } = await supabase
                .from('app_analytics')
                .select('metadata, created_at')
                .eq('event_type', 'kuis_review')
                .order('created_at', { ascending: false })
                .limit(20);

            if (reviewsError) console.error("Reviews Error:", reviewsError);

            return res.status(200).json({
                success: true,
                attempts: count || 0,
                reviews: reviews || []
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { action, metadata } = req.body;
            
            if (action === 'attempt') {
                await supabase.from('app_analytics').insert([{
                    event_type: 'kuis_attempt',
                    query: 'start',
                    metadata: {},
                    created_at: new Date().toISOString()
                }]);
            } else if (action === 'review') {
                await supabase.from('app_analytics').insert([{
                    event_type: 'kuis_review',
                    query: 'review',
                    metadata: metadata, // { name, score, rating, comment }
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
