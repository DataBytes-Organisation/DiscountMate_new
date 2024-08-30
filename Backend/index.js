const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');


// PostgreSQL client configuration
const client = new Client({
    user: 'postgres',  // Replace with your PostgreSQL username
    host: 'localhost',     // Replace with your PostgreSQL host
    database: 'discountmate', // Replace with your PostgreSQL database name
    password: 'password',  // Replace with your PostgreSQL password
    port: 5432,            // Replace with your PostgreSQL port if different
});

// Connect to PostgreSQL
client.connect(err => {
    if (err) {
        console.error('Connection error', err.stack);
    } else {
        console.log('Connected to PostgreSQL');
    }
});


const app = express();
const PORT = process.env.PORT || 5000;

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use the appropriate email service (e.g., Gmail, Outlook)
    auth: {
        user: 'testingnodemailer3@gmail.com',
        pass: 'obml zgob pycg dbei', 
    },
});

app.use(cors({
    origin: 'http://localhost:8081', // Replace with your frontend origin
    methods: 'GET,POST,PUT,DELETE',
    credentials: true
}));

app.use(bodyParser.json());

// Signup API
app.post('/signup', async (req, res) => {
    const { useremail, password, verifyPassword, user_fname, user_lname, address, phone_number } = req.body;

    try {
        // Log the received data to the console
        console.log('Received signup data:', {
            useremail,
            password,
            verifyPassword,
            user_fname,
            user_lname,
            address,
            phone_number
        });

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a unique user ID (using UUID for simplicity)
        const userId = Math.floor(Math.random() * 1000000); // Replace with UUID if needed

        // Insert the new user into the PostgreSQL database
        const query = `
            INSERT INTO "user" (user_id, account_user_name, email, encrypted_password, user_fname, user_lname, address, phone_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        const values = [userId, useremail, useremail, hashedPassword, user_fname, user_lname, address, phone_number];
        await client.query(query, values);

        // Send a success response
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error("Error signing up user:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});




// Inside your signin API
app.post('/signin', async (req, res) => {
    const { useremail, password } = req.body;
    try {
        const query = 'SELECT encrypted_password FROM "user" WHERE email = $1';
        const values = [useremail];
        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const userPassword = result.rows[0].encrypted_password;
        const isMatch = await bcrypt.compare(password, userPassword);

        if (isMatch) {
            // Generate JWT
            const token = jwt.sign({ useremail }, 'your_jwt_secret', { expiresIn: '1h' });
            return res.status(200).json({ message: 'Signin successful', token });
        } else {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error("Error during signin:", error);
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

