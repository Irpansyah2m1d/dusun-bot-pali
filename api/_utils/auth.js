const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'super-secret-key-change-this';

/**
 * Middleware-like function to verify JWT Token from Authorization Header
 */
module.exports = (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Also check legacy header for transition if needed, 
            // but for security we strictly transition to Bearer
            return null;
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        return decoded;
    } catch (err) {
        return null;
    }
};
