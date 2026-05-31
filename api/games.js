const kuisHandler = require('./_games/kuis');
const kuisAnalyticsHandler = require('./_games/kuis-analytics');
const typingHandler = require('./_games/typing');
const typingAnalyticsHandler = require('./_games/typing-analytics');

module.exports = async (req, res) => {
    const { route } = req.query;

    if (route === 'kuis') {
        return kuisHandler(req, res);
    } else if (route === 'kuis-analytics') {
        return kuisAnalyticsHandler(req, res);
    } else if (route === 'typing') {
        return typingHandler(req, res);
    } else if (route === 'typing-analytics') {
        return typingAnalyticsHandler(req, res);
    }

    return res.status(404).json({ success: false, message: 'Game route not found' });
};
