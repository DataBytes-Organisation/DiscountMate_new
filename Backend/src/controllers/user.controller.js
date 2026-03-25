
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // used for signin token creation
const User = require('../schemas/models');
const { connectToMongoDB } = require('../config/database');
const fs = require('fs');
const mime = require('mime-types');
const rateLimit = require('express-rate-limit'); // NEW: imported for  rate limiting

// NEW: signup rate limiter (CS-02-T3)
const signupLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // NEW: 5 minute rate limit window
    limit: 5,                // NEW: max 5 requests per IP in window
    message: 'Too many requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// NEW: signin rate limiter (CS-02-T3)
const signinLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // NEW: 5 minute rate limit window
    limit: 5,                // NEW: max 5 requests per IP in window
    message: 'Too many requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Signup Controller
const signup = async (req, res) => {
    const { email, password, verifyPassword, user_fname, user_lname, address, phone_number, admin } = req.body;

    try {
        const normalizedEmail = (email || '').trim().toLowerCase();

        if (!normalizedEmail) {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!password || !verifyPassword) {
            return res.status(400).json({ message: 'Password and verifyPassword are required' });
        }

        // Establish MongoDB connection and get the db object
        const db = await connectToMongoDB(); // Await the connection to get the db object


         // NEW: password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters long and include uppercase letters, lowercase letters, numbers, and special characters.'
            });
        }

        // Check if the passwords match
        if (password !== verifyPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the new user object to insert
        const user = {
            account_user_name: normalizedEmail,
            email: normalizedEmail,
            encrypted_password: hashedPassword,
            user_fname,
            user_lname,
            address,
            phone_number,
            admin: admin || false,
        };

        // Insert the user into the database
        const result = await db.collection('users').insertOne(user);

        // Send a success response
        res.status(201).json({ message: 'User created successfully', userId: result.insertedId });

    } catch (error) {
        console.error('Error signing up user:', error);
        res.status(500).json({ message: 'Error signing up user' });
    }
};



// Signin Controller
const signin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const db = await connectToMongoDB();

        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        const user = await db.collection('users').findOne({ email: email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.encrypted_password);

        if (isMatch) {
            const token = jwt.sign({ email, admin: user.admin }, process.env.JWT_SECRET, { expiresIn: '1h' });
            return res.status(200).json({ message: 'Signin successful', token, admin: user.admin });
        } else {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error signing in user:', error);
        res.status(500).json({ message: 'Error signing in user' });
    }
};

// Get Profile Controller
const getProfile = async (req, res) => {
    try {
        // NEW: Access the email directly from req.user, which is populated by the verifyToken middleware - IS
        const email = req.user.email; // Access email directly from req.user (no need to decode token here)

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        // Fetch user details from the database using the email, excluding the password field
        const user = await db.collection('users').findOne({ email }, { projection: { encrypted_password: 0 } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Send back user profile details (excluding password)
        return res.status(200).json({
            user_fname: user.user_fname,
            user_lname: user.user_lname,
            email: user.email,
            address: user.address,
            phone_number: user.phone_number,
            admin: user.admin,
            profile_image: user.profile_image || null,
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Update Profile Image Controller
const updateProfileImage = async (req, res) => {
    try {
        // NEW: use req.user from auth middleware instead of jwt.verify in controller (CS-02-T2 / T5)
        const email = req.user.email;

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const mimeType = mime.lookup(file.originalname); // Existing file MIME lookup
        const imageData = fs.readFileSync(file.path);    // Existing file read as Buffer

        const updateResult = await db.collection('users').updateOne(
            { email },
            {
                $set: {
                    profile_image: {
                        mime: mimeType,
                        content: imageData
                    }
                }
            }
        );

        if (updateResult.modifiedCount === 1) {
            return res.status(200).json({ profile_image: 'Updated successfully' });
        } else {
            return res.status(500).json({ message: 'Failed to update profile image' });
        }

    } catch (error) {
        console.error('Error updating profile image:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


// Get Profile Image Controller
const getProfileImage = async (req, res) => {
    try {
        // NEW: use req.user from auth middleware instead of jwt.verify in controller (CS-02-T2 / T5)
        const email = req.user.email;

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne({ email });

        if (!user || !user.profile_image) {
            return res.status(404).json({ message: 'Profile image not found' });
        }

        // NEW: return stored profile image object from MongoDB
        // This matches how updateProfileImage stores the image { mime, content }
        return res.status(200).json(user.profile_image);

    } catch (error) {
        console.error('Error fetching profile image:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    signup,
    signin,
    getProfile,
    updateProfileImage,
    getProfileImage,
    signupLimiter, // NEW: export signup limiter for router use
    signinLimiter  // NEW: export signin limiter for router use
};

