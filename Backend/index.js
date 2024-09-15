const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

// MongoDB Atlas connection string
const uri = 'mongodb+srv://discountmate:discountmate1@discountmatecluster.u80y7ta.mongodb.net/user-auth-test?retryWrites=true&w=majority&appName=DiscountMateCluster';

const app = express();
const PORT = process.env.PORT || 5000;

let db;

// Async function to connect to MongoDB Atlas
async function connectToMongoDB() {
    try {
        const client = await MongoClient.connect(uri); // No need for useUnifiedTopology
        db = client.db('user-data'); // Use your database name here
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.error('Connection error to MongoDB:', err);
    }
}

// Connect to MongoDB when the server starts
connectToMongoDB();

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'testingnodemailer3@gmail.com',
        pass: 'obml zgob pycg dbei',
    },
});

app.use(cors({
    origin: "*",
    methods: 'GET,POST,PUT,DELETE',
    credentials: true
}));

app.use(bodyParser.json());

// Signup API
app.post('/signup', async (req, res) => {
    const { useremail, password, verifyPassword, user_fname, user_lname, address, phone_number, admin } = req.body;

    try {
        console.log('Received signup data:', req.body);

        // Check if database is initialized
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new user into the MongoDB database
        const user = {
            account_user_name: useremail,
            email: useremail,
            encrypted_password: hashedPassword,
            user_fname,
            user_lname,
            address,
            phone_number,
            admin: admin || false, // Include the admin field, default to false if not provided
        };

        const result = await db.collection('users').insertOne(user);

        // Send a success response
        res.status(201).json({ message: 'User created successfully', userId: result.insertedId });
    } catch (error) {
        console.error('Error signing up user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Signin API
app.post('/signin', async (req, res) => {
    const { useremail, password } = req.body;

    try {
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        const user = await db.collection('users').findOne({ email: useremail });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.encrypted_password);

        if (isMatch) {
            const token = jwt.sign({ useremail, admin: user.admin }, 'your_jwt_secret', { expiresIn: '1h' });
            return res.status(200).json({ message: 'Signin successful', token, admin: user.admin });
        } else {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error during signin:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Profile API to return user details if logged in
app.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token provided, please log in' });
        }

        // Verify the JWT token
        jwt.verify(token, 'your_jwt_secret', async (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Invalid token, please log in again' });
            }

            const useremail = decoded.useremail;

            // Fetch the user details from the database
            const user = await db.collection('users').findOne({ email: useremail }, { projection: { encrypted_password: 0 } });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Send back user profile details, including the admin field
            return res.status(200).json({ 
                user_fname: user.user_fname,
                user_lname: user.user_lname,
                email: user.email,
                address: user.address,
                phone_number: user.phone_number,
                admin: user.admin  // Include the admin field
            });
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Contact Form Submission API
app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;

    // Email options
    const mailOptions = {
        from: 'testingnodemailer3@gmail.com', // The email address of the sender (from the form)
        to: 'testingnodemailer3@gmail.com', // The email address where you want to receive the contact form messages
        subject: 'New Contact Form Submission',
        text: `You have a new contact form submission:\n\nName: ${name}\nEmail: ${email}\nMessage: ${message}`,
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ message: 'Failed to send email' });
        }

        console.log('Email sent:', info.response);
        res.json({ message: 'Feedback received and email sent' });
    });
});

// Placeholder for future APIs
app.get('/future-api', (req, res) => {
    res.send('This is a placeholder for future APIs');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
