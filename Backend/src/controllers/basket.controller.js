const { connectToMongoDB } = require('../config/database');

/**
 * Basket controller relies on req.user from auth middleware instead of decoding
 * JWT tokens inside controller functions.
 */

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

function getAuthenticatedEmail(req) {
    return req.user?.email || null;
}

async function findAuthenticatedUser(db, req) {
    const email = getAuthenticatedEmail(req);
    if (!email) {
        return null;
    }

    return db.collection('users').findOne(
        { email },
        { projection: { encrypted_password: 0 } }
    );
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

const getBasket = async (req, res) => {
    try {
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await findAuthenticatedUser(db, req);
        if (!user || !user._id) {
            return res.status(401).json({ message: 'Invalid or missing user data' });
        }

        const basket = await db.collection('basket').find({ user_id: user._id.toString() }).toArray();
        const response = [];

        for (const item of basket) {
            const currentProductId = item.product_id;

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
                    quantity: item.quantity,
                });
            } catch (err) {
                console.error('Error fetching product details:', err.message);
            }
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching basket items:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const addToBasket = async (req, res) => {
    try {
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await findAuthenticatedUser(db, req);
        if (!user || !user._id) {
            return res.status(401).json({ message: 'Invalid or missing user data' });
        }

        const productId = String(req.body.productId || req.body.product_id || '').trim();
        if (!productId) {
            return res.status(400).json({ message: 'Product id is required' });
        }

        const quantity = Math.max(1, Number(req.body.quantity || 1));

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
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

const updateQuantity = async (req, res) => {
    try {
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await findAuthenticatedUser(db, req);
        if (!user || !user._id) {
            return res.status(401).json({ message: 'Invalid or missing user data' });
        }

        const productId = String(req.body.productId || req.body.product_id || '').trim();
        if (!productId) {
            return res.status(400).json({ message: 'Product id is required' });
        }

        const quantity = Number(req.body.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'Quantity must be greater than 0' });
        }

        const updateResult = await db.collection('basket').updateOne(
            { user_id: user._id.toString(), product_id: productId },
            { $set: { quantity } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: 'Basket item not found' });
        }

        return res.status(200).json({ message: 'Quantity updated successfully' });
    } catch (error) {
        console.error('Error updating basket quantity:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const deleteFromBasket = async (req, res) => {
    try {
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await findAuthenticatedUser(db, req);
        if (!user || !user._id) {
            return res.status(401).json({ message: 'Invalid or missing user data' });
        }

        const productId = String(req.body.productId || req.body.product_id || '').trim();
        if (!productId) {
            return res.status(400).json({ message: 'Product id is required' });
        }

        const deleteResult = await db.collection('basket').deleteMany({
            user_id: user._id.toString(),
            product_id: productId,
        });

        if (deleteResult.deletedCount === 0) {
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
    deleteFromBasket,
};
