const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { connectToMongoDB } = require('../config/database');
const { processPriceEvents } = require('../utils/priceAlerts');

const COLLECTION_NAME = 'price_alerts';
const CONDITIONS = ['price_at_or_below', 'percent_off_at_least'];
const MAX_ALERTS = 50;
const DUPLICATE_MESSAGE = 'You already have an alert for this product with the same condition and threshold.';

function getToken(req) {
    return req.headers.authorization && req.headers.authorization.split(' ')[1];
}

async function getAuthenticatedUser(req) {
    const token = getToken(req);
    if (!token) {
        const err = new Error('Authorization token is required');
        err.status = 401;
        throw err;
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        const err = new Error('Invalid token, please log in again');
        err.status = 401;
        throw err;
    }

    const db = await connectToMongoDB();
    const user = await db.collection('users').findOne(
        { email: decoded.email },
        { projection: { encrypted_password: 0 } }
    );

    if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    return { db, user };
}

function badRequest(res, path, message) {
    return res.status(400).json({ message, errors: [{ path, msg: message }] });
}

function toResponse(doc) {
    const out = { ...doc, id: String(doc._id) };
    delete out._id;
    delete out.user_email;
    return out;
}

function findFieldError(condition, threshold, channels) {
    if (!CONDITIONS.includes(condition)) return { path: 'condition', message: 'Unsupported condition.' };
    if (typeof threshold !== 'number' || Number.isNaN(threshold) || threshold <= 0) {
        return { path: 'threshold', message: 'Threshold must be a number greater than 0.' };
    }
    if (condition === 'price_at_or_below' && threshold > 10000) {
        return { path: 'threshold', message: 'Price threshold cannot be more than 10000.' };
    }
    if (condition === 'percent_off_at_least' && threshold > 100) {
        return { path: 'threshold', message: 'Percent threshold cannot be more than 100.' };
    }
    if (!channels || typeof channels.email !== 'boolean' || typeof channels.push !== 'boolean') {
        return { path: 'channels', message: 'Channels must say true or false for email and push.' };
    }
    if (!channels.email && !channels.push) return { path: 'channels', message: 'Select at least one notification channel.' };
    return null;
}

async function findOwnedAlert(db, req, user) {
    if (!ObjectId.isValid(req.params.id)) return null;
    return db.collection(COLLECTION_NAME).findOne({ _id: new ObjectId(req.params.id), user_email: user.email });
}

async function getPriceAlerts(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const alerts = await db.collection(COLLECTION_NAME).find({ user_email: user.email }).sort({ created_at: -1 }).toArray();
        return res.status(200).json({ alerts: alerts.map(toResponse) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error('Error fetching price alerts:', error);
        return res.status(500).json({ message: 'Failed to load price alerts' });
    }
}

async function createPriceAlert(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const { product_code, condition, threshold, channels } = req.body || {};
        const code = String(product_code === undefined || product_code === null ? '' : product_code).trim();
        if (!code) return badRequest(res, 'product_code', 'Product code is required.');
        const fieldError = findFieldError(condition, threshold, channels);
        if (fieldError) return badRequest(res, fieldError.path, fieldError.message);

        const product = await db.collection('products').findOne({ product_code: { $in: [code, Number(code)] } });
        if (!product) return res.status(404).json({ message: 'Product not found.' });

        const collection = db.collection(COLLECTION_NAME);
        const duplicate = await collection.findOne({ user_email: user.email, product_code: code, condition, threshold });
        if (duplicate) return res.status(409).json({ message: DUPLICATE_MESSAGE });
        if (await collection.countDocuments({ user_email: user.email }) >= MAX_ALERTS) {
            return res.status(409).json({ message: `You have reached the maximum of ${MAX_ALERTS} price alerts.` });
        }

        const now = new Date();
        const alert = {
            user_email: user.email,
            product_code: code,
            product_name: String(product.product_name || 'Unnamed product'),
            condition,
            threshold,
            channels: { email: channels.email, push: channels.push },
            status: 'enabled',
            last_evaluated_at: null,
            last_triggered_at: null,
            last_price_seen: null,
            last_delivery: null,
            created_at: now,
            updated_at: now,
        };
        const result = await collection.insertOne(alert);
        return res.status(201).json({ alert: toResponse({ ...alert, _id: result.insertedId }) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error('Error creating price alert:', error);
        return res.status(500).json({ message: 'Failed to create price alert' });
    }
}

async function updatePriceAlert(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const alert = await findOwnedAlert(db, req, user);
        if (!alert) return res.status(404).json({ message: 'Alert not found.' });

        const body = req.body || {};
        const condition = body.condition === undefined ? alert.condition : body.condition;
        const threshold = body.threshold === undefined ? alert.threshold : body.threshold;
        const channels = body.channels === undefined ? alert.channels : body.channels;
        const fieldError = findFieldError(condition, threshold, channels);
        if (fieldError) return badRequest(res, fieldError.path, fieldError.message);

        const duplicate = await db.collection(COLLECTION_NAME).findOne({
            _id: { $ne: alert._id }, user_email: user.email, product_code: alert.product_code, condition, threshold,
        });
        if (duplicate) return res.status(409).json({ message: DUPLICATE_MESSAGE });

        const changes = { condition, threshold, channels: { email: channels.email, push: channels.push }, updated_at: new Date() };
        await db.collection(COLLECTION_NAME).updateOne({ _id: alert._id }, { $set: changes });
        return res.status(200).json({ alert: toResponse({ ...alert, ...changes }) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error('Error updating price alert:', error);
        return res.status(500).json({ message: 'Failed to update price alert' });
    }
}

async function updatePriceAlertStatus(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const status = req.body && req.body.status;
        if (status !== 'enabled' && status !== 'disabled') return badRequest(res, 'status', 'Status must be enabled or disabled.');
        const alert = await findOwnedAlert(db, req, user);
        if (!alert) return res.status(404).json({ message: 'Alert not found.' });

        const changes = { status, updated_at: new Date() };
        await db.collection(COLLECTION_NAME).updateOne({ _id: alert._id }, { $set: changes });
        return res.status(200).json({ alert: toResponse({ ...alert, ...changes }) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error('Error updating price alert status:', error);
        return res.status(500).json({ message: 'Failed to update price alert status' });
    }
}

async function deletePriceAlert(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const alert = await findOwnedAlert(db, req, user);
        if (!alert) return res.status(404).json({ message: 'Alert not found.' });

        await db.collection(COLLECTION_NAME).deleteOne({ _id: alert._id });
        await db.collection('notification_deliveries').deleteMany({ alert_id: alert._id });
        return res.status(200).json({ message: 'Alert deleted.' });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error('Error deleting price alert:', error);
        return res.status(500).json({ message: 'Failed to delete price alert' });
    }
}

async function getPriceAlertDeliveries(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const alert = await findOwnedAlert(db, req, user);
        if (!alert) return res.status(404).json({ message: 'Alert not found.' });

        const deliveries = await db.collection('notification_deliveries')
            .find({ alert_id: alert._id }).sort({ created_at: -1 }).limit(20).toArray();
        return res.status(200).json({ deliveries: deliveries.map(toResponse) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error('Error fetching price alert deliveries:', error);
        return res.status(500).json({ message: 'Failed to load deliveries' });
    }
}

async function receivePriceEvents(req, res) {
    const secret = process.env.PRICE_EVENT_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: 'Price event ingestion is not configured.' });
    if (req.headers['x-price-event-secret'] !== secret) return res.status(401).json({ message: 'Invalid price event secret.' });
    const events = req.body && req.body.events;
    if (!Array.isArray(events)) return badRequest(res, 'events', 'events must be an array.');

    try {
        console.log('Price events received via webhook:', events.length);
        return res.status(202).json(await processPriceEvents(events));
    } catch (error) {
        console.error('Error processing price events:', error);
        return res.status(500).json({ message: 'Failed to process price events' });
    }
}

module.exports = {
    getPriceAlerts,
    createPriceAlert,
    updatePriceAlert,
    updatePriceAlertStatus,
    deletePriceAlert,
    getPriceAlertDeliveries,
    receivePriceEvents,
};
