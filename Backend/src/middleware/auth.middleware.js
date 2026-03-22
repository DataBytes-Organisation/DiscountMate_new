
require('dotenv').config();
const jwt = require('jsonwebtoken');

// new Changed the logic for extracting the token from the Authorization header to explicitly check if it starts with 'Bearer ' 
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
        ? req.headers.authorization.split(' ')[1] // Extract the token part after "Bearer"
        : null; // If no token is found, set it to null

    if (!token) {
        return res.status(403).json({message: "A token is required for authentication"});
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        next();
    } catch (err) {

        if (err.name === "TokenExpiredError") {
            return res.status(401).json({message: "Token Has Expired"});
        }
        return res.status(401).json({ message: "Invalid Token"});
    }
    
};

module.exports = verifyToken;
