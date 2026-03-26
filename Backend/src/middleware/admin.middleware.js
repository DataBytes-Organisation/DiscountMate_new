// NEW: admin-only authorization middleware 
const isAdmin = (req, res, next) => {
    try {
        // NEW: block access if user is not an admin
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Admins only' });
        }

        // NEW: allow request to continue if role is admin
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = isAdmin;