
const { connectToMongoDB } = require('../config/database'); 
const jwt = require('jsonwebtoken');
require('dotenv').config()
const BASE_URL = process.env.BASE_URL;

// basketController.js

const fetch = require('node-fetch');


const getUserFromToken = async (token) => {
    let user;
    await jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.log("Error in token verification=", err);
            return null;
        }

        const email = decoded.email;
        const db = await connectToMongoDB()
        user = await db.collection('users').findOne({ email: email }, { projection: { encrypted_password: 0 } });
    });
    return user;
};

// Function to get the basket for a user
const getBasket = async (req, res) => {
    try {
      // Fetch the basket details from the database
      const db = await connectToMongoDB()
      const baskets = await db.collection('basket').find().toArray();
      const getProductUrl = `${BASE_URL}/api/products/getproduct`;
  
      if (!baskets) {
        return res.status(404).json({ message: 'Basket not found' });
      }
  
      const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
      const user = await getUserFromToken(token);
      const basket = await db.collection('basket').find({ user_id: user._id.toString() }).toArray();
  
      console.log('Basket for a particular user contains=', basket);
  
      const response = [];
  
      // Get product details for each product ID
      for (let i = 0; i < basket.length; i++) {
        const currentProductId = basket[i].product_id;
        const getProductData = { productId: currentProductId };
  
        try {
          const productResponse = await fetch(getProductUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getProductData),
          });
  
          const data = await productResponse.json();
  
          response.push({
            productId: data.product_id,
            name: data.product_name,
            price: data.current_price,
            image: data.link_image,
            quantity: basket[i].quantity,
          });
        } catch (err) {
          console.error('Error fetching product details:', err.message);
        }
      }
  
      res.json(response);
    } catch (error) {
      console.error('Error fetching basket items:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

// Function to add an item to the basket
const addToBasket = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Authorization token is required' });
        }

        const user = await getUserFromToken(token);
        if (!user || !user._id) {
            return res.status(401).json({ message: 'Invalid or missing user data' });
        }

        const basketItem = {
            user_id: user._id.toString(),
            quantity: req.body.quantity || 1,
            product_id: req.body.product_id,
        };

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        await db.collection('basket').insertOne(basketItem);
        return res.status(201).json({ message: 'Item added to basket successfully' });
    } catch (error) {
        console.error('Error adding item to basket:', error.message);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};


// Function to update the quantity of an item in the basket
const updateQuantity = async (req, res, db) => {
    try {
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
        const user = await getUserFromToken(token);

        const query = { "user_id": user._id.toString(), "product_id": req.body.productId };
        const db = await connectToMongoDB();
        const updateResult = await db.collection('basket').updateOne(
            query,
            { $set: { quantity: req.body.quantity } }
        );

        if (updateResult.modifiedCount === 0) {
            console.log('No documents were updated.');
        } else {
            console.log('Document updated successfully.');
        }

        const getBasketUrl = `${BASE_URL}/api/baskets/getbasket`;
        
        await fetch(getBasketUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
          })
            .then(res1 => res1.json())
            .then(data => res.json(data))
            .catch(err => console.error(err.message));

    } catch (error) {
        console.log("Error updating quantity in basket =", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Function to delete an item from the basket
const deleteFromBasket = async (req, res, db) => {
    try {
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
        const user = await getUserFromToken(token);

        const query = { "user_id": user._id.toString(), "product_id": req.body.productId };
        const db = await connectToMongoDB();
        const deleteResult = await db.collection('basket').deleteOne(query);
        console.log(`Deleted ${deleteResult.deletedCount} document(s)`);

        const getBasketUrl = `${BASE_URL}/api/baskets/getbasket`;
        
        await fetch(getBasketUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
          })
            .then(res1 => res1.json())
            .then(data => res.json(data))
            .catch(err => console.error(err.message));

    } catch (error) {
        console.log("Error deleting item from basket =", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getBasket,
    addToBasket,
    updateQuantity,
    deleteFromBasket
};




