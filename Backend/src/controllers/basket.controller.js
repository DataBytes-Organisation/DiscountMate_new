
const { connectToMongoDB } = require('../config/database');

// Import verifyToken middleware to protect routes
const verifyToken = require('../middleware/auth.middleware');  // <-- Added this line to import the middleware

/**
 * Get Basket Controller (Secured with JWT)
 */
const getBasket = async (req, res) => {
    try {
        // NEW: Accessing the email directly from req.user (populated by JWT middleware)
        const email = req.user.email; // <-- Access email directly from req.user (this is populated by the middleware)

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        // NEW: find the logged-in user using the email from req.user
        const user = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // EXISTING LOGIC: get basket items for this user
        const basket = await db.collection('basket')
            .find({ user_id: user._id.toString() })
            .toArray();

        return res.status(200).json(basket);
    } catch (error) {
        console.error('Error fetching basket:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * Add Item to Basket Controller (Secured with JWT)
 */
const addToBasket = async (req, res) => {
    try {
        // NEW: Accessing the email directly from req.user (populated by JWT middleware)
        const email = req.user.email; // <-- Access email directly from req.user

        const { product_id, quantity } = req.body;

        if (!product_id) {
            return res.status(400).json({ message: 'product_id is required' });
        }

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        // NEW: find the logged-in user using the email from req.user
        const user = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the item already exists in the basket
        const existingItem = await db.collection('basket').findOne({
            user_id: user._id.toString(),
            product_id
        });

        if (existingItem) {
            // EXISTING/IMPROVED LOGIC: if product already exists, increase quantity
            await db.collection('basket').updateOne(
                {
                    user_id: user._id.toString(),
                    product_id
                },
                {
                    $set: {
                        quantity: (existingItem.quantity || 0) + (quantity || 1)
                    }
                }
            );

            return res.status(200).json({ message: 'Basket item quantity updated successfully' });
        }

        // If item doesn't exist, add it to the basket
        const basketItem = {
            user_id: user._id.toString(),
            product_id,
            quantity: quantity || 1
        };

        await db.collection('basket').insertOne(basketItem);

        return res.status(201).json({ message: 'Item added to basket successfully' });
    } catch (error) {
        console.error('Error adding item to basket:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * Update Quantity Controller (Secured with JWT)
 */
const updateQuantity = async (req, res) => {
    try {
        // NEW: Accessing the email directly from req.user (populated by JWT middleware)
        const email = req.user.email; // <-- Access email directly from req.user

        const { productId, quantity } = req.body;

        if (!productId) {
            return res.status(400).json({ message: 'productId is required' });
        }

        if (quantity === undefined || quantity === null) {
            return res.status(400).json({ message: 'quantity is required' });
        }

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        // NEW: find the logged-in user using the email from req.user
        const user = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the basket with the new quantity
        const result = await db.collection('basket').updateOne(
            {
                user_id: user._id.toString(),
                product_id: productId
            },
            {
                $set: { quantity }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'Basket item not found or quantity unchanged' });
        }

        return res.status(200).json({ message: 'Quantity updated successfully' });
    } catch (error) {
        console.error('Error updating basket quantity:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * Delete Item from Basket Controller (Secured with JWT)
 */
const deleteFromBasket = async (req, res) => {
    try {
        // NEW: Accessing the email directly from req.user (populated by JWT middleware)
        const email = req.user.email; // <-- Access email directly from req.user

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ message: 'productId is required' });
        }

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        // NEW: find the logged-in user using the email from req.user
        const user = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove the product from the basket
        const result = await db.collection('basket').deleteOne({
            user_id: user._id.toString(),
            product_id: productId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Product not found in the basket' });
        }

        return res.status(200).json({ message: 'Item deleted from basket successfully' });
    } catch (error) {
        console.error('Error deleting basket item:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getBasket,
    addToBasket,
    updateQuantity,
    deleteFromBasket
};


