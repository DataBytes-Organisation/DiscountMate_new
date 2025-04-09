const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../schemas/models');
const { connectToMongoDB } = require('../config/database'); 
const fs = require('fs');
const mime = require('mime-types'); 

// Signup Controller
const signup = async (req, res) => {
    const { email, password, verifyPassword, user_fname, user_lname, address, phone_number, admin } = req.body;

    try {
        // Establish MongoDB connection and get the db object
        const db = await connectToMongoDB(); // Await the connection to get the db object

        console.log('Received signup data:', req.body);

        // Check if the passwords match
        if (password !== verifyPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the new user object to insert
        const user = {
            email: email,
            encrypted_password: hashedPassword,
            user_fname,
            user_lname,
            address,
            phone_number,
            admin: admin || false,
        };

        // Insert the user into the database (using native MongoDB method)
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
    console.log('Email:', email);
    console.log('Password:', password);
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
        console.log('Password Match:', isMatch); 
        if (isMatch) {
            const token = jwt.sign({ email, admin: user.admin }, 'your_jwt_secret', { expiresIn: '1h' });
            return res.status(200).json({ message: 'Signin successful', token, admin: user.admin });
        } else {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error signing in user' });
    }
};


const getProfile = async (req, res) => {
    // Extract token from Authorization header
    try {
     const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided, please log in' });
    }

    jwt.verify(token, 'your_jwt_secret', async (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token, please log in again' });
        }

        const email = decoded.email;

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }
        // Fetch the user details from the database
        const user = await db.collection('users').findOne({ email }, { projection: { encrypted_password: 0 } });
        console.log('Fetched user:', user);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Profile image value:', user.profile_image);

        // Send back user profile details, including the admin field
        return res.status(200).json({
            user_fname: user.user_fname,
            user_lname: user.user_lname,
            email: user.email,
            address: user.address,
            phone_number: user.phone_number,
            admin: user.admin,
            profile_image: user.profile_image || null, 
        });
    });
} catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Internal Server Error' });
}
};

const updateProfileImage = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, 'your_jwt_secret');
        const email = decoded.email;

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const file = req.file; // Assuming the file is uploaded via form-data
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const mimeType = mime.lookup(file.originalname); // Get MIME type from the file
         const imageData = fs.readFileSync(file.path); // Read file as binary data (Buffer)

        // Update the user profile with mime and content (base64 encoded image)
        const updateResult = await db.collection('users').updateOne(
            { email },
            {
              $set: {
                profile_image: {
                  mime: mimeType,
                  content: imageData
                }
              },
            }
          );
        

        if (updateResult.modifiedCount === 1) {
            return res.status(200).json({ profile_image: 'Updated successfully' });
        } else {
            return res.status(500).json({ message: 'Failed to update profile image' });
        }
    } catch (error) {
        console.error('Error updating profile image:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Get Profile Image
const getProfileImage = async (req, res) => {
    try {
      const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }
  
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const email = decoded.email;
  
      const db = await connectToMongoDB();
      const user = await db.collection('users').findOne({ email });
  
      if (!user || !user.profile_image) {
        return res.status(404).json({ message: 'Profile image not found' });
      }
  
      // Send back the profile image content and MIME type
      res.setHeader('Content-Type', user.profile_image.mime);
      res.send(user.profile_image.content);
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
    getProfileImage
};


