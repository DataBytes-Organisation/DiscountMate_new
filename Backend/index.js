const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const users = []; // This will act as our database for now until it is connected to the actual database

// Signup API
app.post('/signup', async (req, res) => {
    const { useremail, password } = req.body;

    // Check if user already exists
    const userExists = users.find(user => user.useremail === useremail);
    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the new user
    users.push({ useremail, password: hashedPassword });

    res.status(201).json({ message: 'User created successfully' });
});

// Signin API
app.post('/signin', async (req, res) => {
    const { useremail, password } = req.body;

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

// Placeholder for future APIs
app.get('/future-api', (req, res) => {
    res.send('This is a placeholder for future APIs');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
