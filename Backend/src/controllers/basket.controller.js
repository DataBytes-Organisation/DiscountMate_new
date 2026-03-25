
const { connectToMongoDB } = require('../config/database');

/**
 * NEW: CS-02-T2 / CS-02-T5
 * Basket controller now relies on req.user from auth middleware
 * instead of decoding JWT tokens inside controller functions.
 */

/**
 * Get Basket
 */
const getBasket = async (req, res) => {
    try {
        // NEW: use authenticated user from middleware
        const email = req.user.email;

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        // NEW: get full user record using email from req.user
        const user = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Existing basket lookup, now tied to authenticated user
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
        // NEW: use authenticated user from middleware
        const email = req.user.email;

        const { product_id, quantity } = req.body;

        if (!product_id) {
            return res.status(400).json({ message: 'product_id is required' });
        }

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        // NEW: get full user record using email from req.user
        const user = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const existingItem = await db.collection('basket').findOne({
            user_id: user._id.toString(),
            product_id
        });

        if (existingItem) {
            // Existing/improved logic: increase quantity if item already exists
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
 * Update Quantity Controller 
 */
const updateQuantity = async (req, res) => {
    try {
        // NEW: use authenticated user from middleware
        const email = req.user.email;

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

        // NEW: get full user record using email from req.user
        const user = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

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
 * Delete Item from Basket Controller 
 */
const deleteFromBasket = async (req, res) => {
    try {
        // NEW: use authenticated user from middleware
        const email = req.user.email;

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ message: 'productId is required' });
        }

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        // NEW: get full user record using email from req.user
        const user = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

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


