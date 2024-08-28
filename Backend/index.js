const admin = require('firebase-admin');
const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
const serviceAccount = require('./discountmate-e8cbb-firebase-adminsdk-qj67v-934f4bf808.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // Initialize Firestore

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

app.use(cors());
app.use(bodyParser.json());
// const { initializeApp } = require("firebase/app");
// const express = require('express');
// const bcrypt = require('bcryptjs');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const nodemailer = require('nodemailer'); 


// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// // Your Firebase configuration
// const firebaseConfig = {
//     apiKey: "AIzaSyBzN5tFuf_Ds-zh5ARTo7629kTS7qe8EIA",
//     authDomain: "discountmate-e8cbb.firebaseapp.com",
//     projectId: "discountmate-e8cbb",
//     storageBucket: "discountmate-e8cbb.appspot.com",
//     messagingSenderId: "332192323726",
//     appId: "1:332192323726:web:f7a859f36aadc894bc11df",
//     measurementId: "G-7VXJQ0WSFM"
//   };

// // Initialize Firebase
// // Initialize Firebase
// const firebaseapp = initializeApp(firebaseConfig);

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Nodemailer transporter configuration
// const transporter = nodemailer.createTransport({
//     service: 'gmail', // Use the appropriate email service (e.g., Gmail, Outlook)
//     auth: {
//         user: 'testingnodemailer3@gmail.com', // Replace with your email - ensure that the email has nodemailer setup with a passkey.
//         pass: 'obml zgob pycg dbei', // Replace with your email password or app password
//     },
// });

// app.use(cors());
// // Middleware to parse JSON requests
// app.use(bodyParser.json());

// const users = []; // Temporary in-memory "database" for users

// Signup API
app.post('/signup', async (req, res) => {
    const { useremail, password } = req.body;

    try {
        // Check if the user already exists in Firestore
        const userRef = db.collection('users').doc(useremail);
        const doc = await userRef.get();

        if (doc.exists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save the new user to Firestore
        await userRef.set({
            email: useremail,
            password: hashedPassword,
        });

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error("Error signing up user:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Signin API
app.post('/signin', async (req, res) => {
    const { useremail, password } = req.body;
    console.log("Request Recieved");
    // Find the user
    const user = users.find(user => user.useremail === useremail);
    if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Compare the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    res.status(200).json({ message: 'Signin successful' });
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

