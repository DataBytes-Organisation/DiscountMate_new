
const { connectToMongoDB } = require('../config/database'); 
const jwt = require('jsonwebtoken');
require('dotenv').config()

// basketController.js

function getNumberValue(record, keys) {
    for (const key of keys) {
        const value = record?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
            return Number(value);
        }
    }

    return 0;
}

async function findProductByIdentifier(db, identifier) {
    const productIdentifier = String(identifier || '').trim();
    if (!productIdentifier) {
        return null;
    }

    const query = {
        $or: [
            { product_id: productIdentifier },
            { product_code: productIdentifier },
        ],
    };

    const numberIdentifier = Number(productIdentifier);
    if (!Number.isNaN(numberIdentifier)) {
        query.$or.push({ product_code: numberIdentifier });
    }

    if (/^[0-9a-fA-F]{24}$/.test(productIdentifier)) {
        const { ObjectId } = require('mongodb');
        query.$or.push({ _id: new ObjectId(productIdentifier) });
    }

    return db.collection('products').findOne(query);
}

async function findLatestPricing(db, product) {
    if (!product || product?.product_code === null || product?.product_code === undefined) {
        return null;
    }

    return db
        .collection('product_pricings')
        .find({ product_code: product.product_code })
        .sort({ date: -1, created_at: -1, _id: -1 })
        .limit(1)
        .next();
}

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
  
      const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
      const user = await getUserFromToken(token);
      const basket = await db.collection('basket').find({ user_id: user._id.toString() }).toArray();
  
      console.log('Basket for a particular user contains=', basket);
  
      const response = [];
  
      // Get product details for each product ID
      for (let i = 0; i < basket.length; i++) {
        const currentProductId = basket[i].product_id;
  
        try {
          const product = await findProductByIdentifier(db, currentProductId);
          const latestPricing = await findLatestPricing(db, product);
          const price =
            getNumberValue(latestPricing, ['price', 'current_price', 'best_price']) ||
            getNumberValue(product, ['current_price', 'price', 'best_price']);
  
          response.push({
            productId: currentProductId,
            name: product?.product_name || product?.name || 'DiscountMate product',
            price,
            image: product?.link_image || product?.image || null,
            store: latestPricing?.store_chain || latestPricing?.retailer || 'Coles',
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

        const productId = String(req.body.product_id || req.body.productId || '').trim();
        if (!productId) {
            return res.status(400).json({ message: 'Product id is required' });
        }

        const quantity = Math.max(1, Number(req.body.quantity || 1));

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        await db.collection('basket').updateOne(
            {
                user_id: user._id.toString(),
                product_id: productId,
            },
            {
                $inc: { quantity },
                $setOnInsert: {
                    user_id: user._id.toString(),
                    product_id: productId,
                },
            },
            { upsert: true }
        );

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

        const productId = String(req.body.productId || req.body.product_id || '').trim();
        if (!productId) {
            return res.status(400).json({ message: 'Product id is required' });
        }

        const quantity = Number(req.body.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'Quantity must be greater than 0' });
        }

        const query = { "user_id": user._id.toString(), "product_id": productId };
        const db = await connectToMongoDB();
        const updateResult = await db.collection('basket').updateOne(
            query,
            { $set: { quantity } }
        );

        if (updateResult.modifiedCount === 0) {
            console.log('No documents were updated.');
        } else {
            console.log('Document updated successfully.');
        }

        return res.status(200).json({ message: 'Quantity updated successfully' });

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

        const productId = String(req.body.productId || req.body.product_id || '').trim();
        if (!productId) {
            return res.status(400).json({ message: 'Product id is required' });
        }

        const query = { "user_id": user._id.toString(), "product_id": productId };
        const db = await connectToMongoDB();
        const deleteResult = await db.collection('basket').deleteMany(query);
        console.log(`Deleted ${deleteResult.deletedCount} document(s)`);

        return res.status(200).json({ message: 'Item deleted from basket successfully' });

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




