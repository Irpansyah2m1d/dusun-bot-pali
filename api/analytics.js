const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // Only handle POST for logging
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { type, query, metadata } = req.body;
        
        if (!type) {
            return res.status(400).json({ success: false, message: 'Type is required (visitor|search)' });
        }

        // Capture IP for better unique visitor tracking
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const uniqueId = (metadata && metadata.visitor_id) || ip;

        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayStr = todayStart.toISOString();

        // Cari record hari ini untuk tipe event ini
        const { data: existingData, error: fetchError } = await supabase
            .from('app_analytics')
            .select('*')
            .gte('created_at', todayStr)
            .eq('event_type', type)
            .order('id', { ascending: false })
            .limit(1)
            .single();

        if (existingData) {
            let currentMeta = existingData.metadata || {};
            let updated = false;

            if (type === 'visitor') {
                if (!currentMeta.visitors) currentMeta.visitors = [];
                // Ensure uniqueId is string and not already in list
                const strId = String(uniqueId);
                if (!currentMeta.visitors.includes(strId)) {
                    currentMeta.visitors.push(strId);
                    updated = true;
                }
            } else if (type === 'search') {
                if (!currentMeta.queries) currentMeta.queries = [];
                currentMeta.queries.push({ query: query, time: new Date().toISOString() });
                updated = true;
            }

            if (updated) {
                await supabase.from('app_analytics').update({ metadata: currentMeta }).eq('id', existingData.id);
            }
        } else {
            // Create new daily row
            let initialMeta = {};
            if (type === 'visitor') initialMeta.visitors = [String(uniqueId)];
            if (type === 'search') initialMeta.queries = [{ query: query, time: new Date().toISOString() }];

            await supabase.from('app_analytics').insert([{
                event_type: type,
                query: 'daily_summary',
                metadata: initialMeta,
                created_at: new Date().toISOString()
            }]);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Analytics error:", error);
        // Still return 200 to not break client-side experience if logging fails
        return res.status(200).json({ success: true, warning: 'Logged with background error' });
    }
};
