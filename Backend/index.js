const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

// MongoDB Atlas connection string
const uri = ""; 
const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes in milliseconds

const app = express();
const PORT = process.env.PORT || 5002;

let db;
let client; // Declare client globally

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async function sendVerificationEmail(email, code) {
    const mailOptions = {
      from: 'testingnodemailer3@gmail.com',
      to: email,
      subject: 'Your 2FA Verification Code',
      text: `Your verification code is: ${code}. This code will expire in 10 minutes.`,
      html: `
        <h2>Your Two-Factor Authentication Code</h2>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      `
    };
  
    await transporter.sendMail(mailOptions);
  }

// Async function to connect to MongoDB Atlas
async function connectToMongoDB() {
    try {
        client = await MongoClient.connect(uri); // Assign to global client
        db = client.db('user-data'); // Default database for user data
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.error('Connection error to MongoDB:', err);
    }
}

// Connect to MongoDB and start the server after a successful connection
connectToMongoDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
});

app.use(cors({
    origin: "*",
    methods: 'GET,POST,PUT,DELETE',
    credentials: true
}));

app.use(bodyParser.json());

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'testingnodemailer3@gmail.com',
        pass: 'obml zgob pycg dbei',
    },
});

// Root route to avoid 404 error
app.get('/', (req, res) => {
    res.send('Welcome to the DiscountMate API!');
});

// Endpoint to get products from 'user-data'
app.get('/products', async (req, res) => {
    try {
        console.log('Fetching products from MongoDB...');
        
        if (!client) {
            return res.status(500).json({ message: 'Database client not initialized' });
        }
        
        const sampleDataDb = client.db('user-data'); 
        const products = await sampleDataDb.collection('product').find().toArray();
        
        if (products.length === 0) {
            console.log('No products found');
        } else {
            console.log('Products fetched:', products);
        }
        
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: error.message });
    }
});

// Add these validation functions at the top of your index.js
const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!hasUpperCase) {
        return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!hasNumber) {
        return { isValid: false, message: 'Password must contain at least one number' };
    }
    if (!hasSpecialChar) {
        return { isValid: false, message: 'Password must contain at least one special character' };
    }
    return { isValid: true };
};

// Update the signup endpoint in index.js
// Update the signup endpoint in index.js
app.post('/signup', async (req, res) => {
    const { useremail, password, verifyPassword, user_fname, user_lname, address, phone_number, admin } = req.body;

    try {
        console.log('Received signup data:', req.body);

        // Check if database is initialized
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        // Check if user already exists
        const existingUser = await db.collection('users').findOne({ email: useremail });
        if (existingUser) {
            console.log('User already exists with email:', useremail);
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Validate password
        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        // Check if passwords match
        if (password !== verifyPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        // Check required fields
        if (!user_fname || !user_lname) {
            return res.status(400).json({ message: 'First name and last name are required' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the new user
        const newUser = {
            account_user_name: useremail,
            email: useremail,
            encrypted_password: hashedPassword,
            user_fname,
            user_lname,
            address: address || '',
            phone_number: phone_number || '',
            admin: admin || false,
            created_at: new Date()
        };

        // Insert the new user
        const result = await db.collection('users').insertOne(newUser);

        // Send success response
        res.status(201).json({ 
            message: 'User created successfully', 
            userId: result.insertedId 
        });

    } catch (error) {
        console.error('Error signing up user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
// Update the signin endpoint in index.js
app.post('/signin', async (req, res) => {
    const { useremail, password } = req.body;
  
    try {
      if (!useremail || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
  
      if (!db) {
        return res.status(500).json({ message: 'Database not initialized' });
      }
  
      const user = await db.collection('users').findOne({ email: useremail });
  
      if (!user) {
        return res.status(400).json({ message: 'User does not exist. Please sign up first.' });
      }
  
      const isMatch = await bcrypt.compare(password, user.encrypted_password);
  
      if (isMatch) {
        // Generate and store verification code
        const verificationCode = generateVerificationCode();
        const expiryTime = new Date(Date.now() + VERIFICATION_CODE_EXPIRY);
  
        await db.collection('verification_codes').insertOne({
          email: useremail,
          code: verificationCode,
          expiryTime,
          used: false
        });
  
        // Send verification code via email
        await sendVerificationEmail(useremail, verificationCode);
  
        // Return temporary token for 2FA verification
        const tempToken = jwt.sign(
          { useremail, pending2FA: true },
          'your_jwt_secret',
          { expiresIn: '10m' }
        );
  
        return res.status(200).json({
          message: 'Verification code sent',
          requireVerification: true,
          tempToken
        });
      } else {
        return res.status(400).json({ message: 'Invalid password' });
      }
    } catch (error) {
      console.error('Error during signin:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
  // endpoint to verify 2FA code
  app.post('/verify-2fa', async (req, res) => {
    const { verificationCode, tempToken } = req.body;
  
    try {
      // Verify temp token
      const decoded = jwt.verify(tempToken, 'your_jwt_secret');
      if (!decoded.pending2FA) {
        return res.status(400).json({ message: 'Invalid verification attempt' });
      }
  
      const { useremail } = decoded;
  
      // Find and validate verification code
      const verificationRecord = await db.collection('verification_codes').findOne({
        email: useremail,
        code: verificationCode,
        used: false,
        expiryTime: { $gt: new Date() }
      });
  
      if (!verificationRecord) {
        return res.status(400).json({ message: 'Invalid or expired verification code' });
      }
  
      // Mark verification code as used
      await db.collection('verification_codes').updateOne(
        { _id: verificationRecord._id },
        { $set: { used: true } }
      );
  
      // Get user data for generating final token
      const user = await db.collection('users').findOne({ email: useremail });
  
      // Generate final authentication token
      const token = jwt.sign(
        { useremail, admin: user.admin },
        'your_jwt_secret',
        { expiresIn: '1h' }
      );
  
      return res.status(200).json({
        message: 'Verification successful',
        token,
        admin: user.admin
      });
    } catch (error) {
      console.error('Error during 2FA verification:', error);
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
        from: 'testingnodemailer@gmail.com', // The email address of the sender 
        to: 'testingnodemailer@gmail.com', // The email address where you want to receive the contact form messages
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

// Blog Submission API
app.post('/submit-blog', async (req, res) => {
    const { heading, date, description, user } = req.body;

    try {
        // Check if database is initialized
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        // Insert blog data into the 'blogs' collection
        const result = await db.collection('blogs').insertOne({
            heading,
            description,
            date,
            user,  // The user who submitted the blog
            created_at: new Date()  // Timestamp of when the blog was created
        });

        // Send back a success response with the inserted blog ID
        res.status(201).json({ message: 'Blog data received and saved successfully', blogId: result.insertedId });
    } catch (error) {
        console.error('Error submitting blog:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// News Submission API
app.post('/submit-news', async (req, res) => {
    const { heading, date, description, user } = req.body;

    try {
        // Check if database is initialized
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        // Insert news data into the 'news' collection
        const result = await db.collection('news').insertOne({
            heading,
            description,
            date,
            user,  // The user who submitted the news
            created_at: new Date()  // Timestamp of when the news was created
        });

        // Send back a success response with the inserted news ID
        res.status(201).json({ message: 'News data received and saved successfully', newsId: result.insertedId });
    } catch (error) {
        console.error('Error submitting news:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Get All Blogs - ordered by newest first
app.get('/blogs', async (req, res) => {
    try {
        // Check if the database is initialized
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        // Retrieve all blogs from the 'blogs' collection, sorted by date (newest first)
        const blogs = await db.collection('blogs').find().sort({ date: -1 }).toArray();

        // Send the blogs back in the response
        res.status(200).json(blogs);
    } catch (error) {
        console.error('Error retrieving blogs:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Get All News - ordered by newest first
app.get('/news', async (req, res) => {
    try {
        // Check if the database is initialized
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        // Retrieve all news from the 'news' collection, sorted by date (newest first)
        const news = await db.collection('news').find().sort({ date: -1 }).toArray();

        // Send the news back in the response
        res.status(200).json(news);
    } catch (error) {
        console.error('Error retrieving news:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Gets the User from Token Basket
const getUserFromToken = async(token) =>
    {       
        let user;
        // Verify the JWT token
        await jwt.verify(token, 'your_jwt_secret', async (err, decoded) => {
            if (err) {
                console.log("Error in token verification=", err);
                return null;
            }
    
            const useremail = decoded.useremail;
    
            // Fetch the user details from the database
            user = await db.collection('users').findOne({ email: useremail }, { projection: { encrypted_password: 0 } });
        });
        return user;
    }

// Get Product Basket
app.post('/getproduct', async (req, res) => {
    try
    {
        // Fetch the product details from the product
        const product =  await db.collection('product').findOne({ product_id: req.body.productId });

        //Send back product details
        return res.json({
            "product_id": product.product_id,
            "product_name": product.product_name,
            "link_image": product.link_image,
            "current_price": product.current_price
        });
    }
    catch(error)
    {
        console.log("Error", error);
    }
});

// Get Basket
app.post('/getbasket', async (req, res) => {
    try
    {
        // Fetch the basket details from the database
        
        const baskets =  await db.collection('basket').find().toArray();
        const getProductUrl = 'http://localhost:5002/getproduct';

        if (!baskets) {
            return res.status(404).json({ message: 'Basket not found' });
        }

        console.log("All baskets=", baskets);
    
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
        const user = await getUserFromToken(token);
        const basket = await db.collection('basket').find({ user_id: user._id.toString() }).toArray();
        console.log("Basket for a particular user contains=", basket);
        let response = [];
        // Get product details for each product id

        for(var i = 0; i < basket.length; i++)
        {
            const currentProductId = basket[i].product_id;
            let responseItem = {};

            console.log(currentProductId);
            const getProductData = {
                productId: currentProductId
            };

            await fetch(getProductUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(getProductData),
              })
                .then(res1 => res1.json())
                .then(data => {
                   console.log("Product details=", data);
                  responseItem.productId = data.product_id;
                  responseItem.name = data.product_name;
                  responseItem.price = data.current_price;
                  responseItem.image = data.link_image;
                  responseItem.quantity = basket[i].quantity;

                  response.push(responseItem);
                })
                .catch(err => console.error(err.message));
        }
       
        // Send back user profile details, including the admin field
        res.json(response);
       
    }
    catch(error)
    {
        console.log("Error fetching basket items=>" + error);
    }
});

// Add item to basket
app.post('/addtobasket', async (req, res) => {
    try
    {
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
        const user = await getUserFromToken(token);

        const basketItem = {
            user_id: user._id.toString(),
            quantity: 1,
            product_id: req.body.productId
        };

        const result = await db.collection('basket').insertOne(basketItem);

        const getBasketUrl = "http://localhost:5002/getbasket";
       
        await fetch(getBasketUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
          })
            .then(res1 => res1.json())
            .then(data => {
              res.json(data);
            })
            .catch(err => console.error(err.message));
    }
    catch(error)
    {
        console.log("Error=", error);
    }
});

//Update the Quantity in Basket
app.post('/updatequantity', async(req, res) => {
    try
    {
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
        const user = await getUserFromToken(token);
        // Update the quantity in the db
        const query = {
            "user_id": user._id.toString(),
            "product_id": req.body.productId
        };

        const updateResult = await db.collection('basket').updateOne(
            query, // filter to find the document
            { $set: { quantity: req.body.quantity } } // update operation
          );
       
          if (updateResult.modifiedCount === 0) {
            console.log('No documents were updated. The document may not exist or the quantity was the same as before.');
        } else {
            console.log('Document updated successfully.');
        }
        // Get the basket for the user and return
        const getBasketUrl = "http://localhost:5000/getbasket";
       
        await fetch(getBasketUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
          })
            .then(res1 => res1.json())
            .then(data => {
              res.json(data);
            })
            .catch(err => console.error(err.message));
    }
    catch(error)
    {
        console.log("Encoutered ", error);
    }
});

// Delete From Basket
app.delete('/deleteitemfrombasket', async(req, res) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    const user = await getUserFromToken(token);

    const query = {
        "user_id": user._id.toString(),
        "product_id": req.body.productId
    };

    const deleteResult = await db.collection('basket').deleteOne(query);
    console.log(`Deleted ${deleteResult.deletedCount} document(s)`);

    // Get the basket for the user and return
    const getBasketUrl = "http://localhost:5000/getbasket";
   
    await fetch(getBasketUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      })
        .then(res1 => res1.json())
        .then(data => {
          res.json(data);
        })
        .catch(err => console.error(err.message));
});


// Placeholder for future APIs
app.get('/future-api', (req, res) => {
    res.send('This is a placeholder for future APIs');
});
