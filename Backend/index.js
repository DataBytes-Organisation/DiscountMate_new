const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

// Swagger options
const swaggerOptions = {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'DiscountMate Basket API',
        version: '1.0.0',
        description: 'API documentation for the DiscountMate Basket application',
      },
      components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                },
            },
        },
      servers: [
        {
          url: 'http://localhost:5000',
        },
      ],
    },
    apis: ['./index.js'], // Path to the API docs
  };

// MongoDB Atlas connection string
const uri = "mongodb+srv://discountmate:discountmate1@discountmatecluster.u80y7ta.mongodb.net/?retryWrites=true&w=majority&appName=DiscountMateCluster";

const app = express();
const PORT = process.env.PORT || 5000;

let db;
let client; // Declare client globally

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

    app.use(cors());
    const swaggerDocs = swaggerJsDoc(swaggerOptions);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs)); //Setup Swagger UI

/**
 * @swagger
 * /getproduct:
 *   post:
 *     summary: Get product details by product ID
 *     requestBody:
 *       description: Provide Product Details
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                  type: string
 *     responses:
 *       200:
 *         description: Successful retrieval of product details.
 *         schema:
 *           type: object
 *           properties:
 *             product_id:
 *               type: string
 *               example: "12345"
 *             product_name:
 *               type: string
 *               example: "Sample Product"
 *             link_image:
 *               type: string
 *               example: "http://example.com/image.jpg"
 *             current_price:
 *               type: number
 *               example: 99.99
 *       404:
 *         description: Product not found.
 *       500:
 *         description: Internal server error.
 */

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

/**
 * @swagger
 * /getbasket:
 *   post:
 *     summary: Get user basket details
 *     description: Fetches the basket details for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         description: Bearer token for user authentication.
 *         schema:
 *           type: string
 *           example: "Bearer your_jwt_token"
 *     responses:
 *       200:
 *         description: Successfully fetched the basket items.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   productId:
 *                     type: string
 *                     description: ID of the product.
 *                   name:
 *                     type: string
 *                     description: Name of the product.
 *                   price:
 *                     type: number
 *                     description: Current price of the product.
 *                   image:
 *                     type: string
 *                     description: Link to the product image.
 *                   quantity:
 *                     type: number
 *                     description: Quantity of the product in the basket.
 *       404:
 *         description: Basket not found.
 *       500:
 *         description: Internal server error.
 */

// Get Basket
app.post('/getbasket', async (req, res) => {
    try
    {
        // Fetch the basket details from the database
        
        const baskets =  await db.collection('basket').find().toArray();
        const getProductUrl = 'http://localhost:5000/getproduct';

        if (!baskets) {
            return res.status(404).json({ message: 'Basket not found' });
        }
    
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

        // Log the token to the console for debugging
        console.log("JWT Token:", token);
        console.log("Incoming Headers:", req.headers);

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

/**
 * @swagger
 * /addtobasket:
 *   post:
 *     summary: Add an item to the user's basket
 *     description: Adds a specified product to the authenticated user's basket.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Provide Product Details
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the product to be added to the basket.
 *     responses:
 *       200:
 *         description: Successfully added the product to the basket.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 productId:
 *                   type: string
 *                   description: ID of the added product.
 *                 quantity:
 *                   type: number
 *                   description: Quantity of the added product.
 *       400:
 *         description: Invalid input or product not found.
 *       500:
 *         description: Internal server error.
 */

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
        console.log("Error=", error);
    }
});

/**
 * @swagger
 * /updatequantity:
 *   post:
 *     summary: Update the quantity of a product in the user's basket
 *     description: Updates the quantity of a specified product in the authenticated user's basket.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *      description: Details for updating product quantity
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              productId:
 *                type: string
 *                description: ID of the product whose quantity is to be updated.
 *              quantity:
 *                type: number
 *                description: New quantity of the product.
 *     responses:
 *       200:
 *         description: Successfully updated the quantity in the basket.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   productId:
 *                     type: string
 *                     description: ID of the updated product.
 *                   quantity:
 *                     type: number
 *                     description: New quantity of the product.
 *       400:
 *         description: Invalid input or product not found in the basket.
 *       500:
 *         description: Internal server error.
 */

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

/**
 * @swagger
 * /deleteitemfrombasket:
 *   delete:
 *     summary: Delete a product from the user's basket
 *     description: Removes a specified product from the authenticated user's basket.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: ID of the product to be deleted from the basket.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the product to be removed.
 *     responses:
 *       200:
 *         description: Successfully deleted the product from the basket.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     description: Confirmation message of the deletion.
 *       404:
 *         description: Product not found in the basket.
 *       500:
 *         description: Internal server error.
 */

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

