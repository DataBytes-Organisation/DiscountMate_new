const { ObjectId } = require('mongodb');
const { connectToMongoDB } = require('../config/database');
const jwt = require('jsonwebtoken');
const { syncCategoryAlertNotifications } = require('../utils/alertSegments');

function createAuthError(message = 'Invalid token, please log in again') {
    const error = new Error(message);
    error.statusCode = 401;
    return error;
}

function getAuthEmail(req) {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) {
        throw createAuthError('No token provided, please log in');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.email;
    } catch (error) {
        throw createAuthError('Invalid token, please log in again');
    }
}

function handleControllerError(res, error, fallbackMessage, logPrefix) {
    if (error?.statusCode === 401) {
        return res.status(401).json({
            message: error.message || 'Invalid token, please log in again',
        });
    }

    console.error(logPrefix, error);
    return res.status(500).json({ message: fallbackMessage });
}

function buildOwnershipFilter(user, email) {
    const userId = user?._id ? String(user._id) : null;
    const filters = [{ email }, { user_email: email }, { userEmail: email }];

    if (userId) {
        filters.push({ user_id: userId }, { userId: userId });
        if (ObjectId.isValid(userId)) {
            const objectId = new ObjectId(userId);
            filters.push({ user_id: objectId }, { userId: objectId });
        }
    }

    return { $or: filters };
}

function getCollection(db, name) {
    return db.listCollections({ name }).hasNext().then((exists) => {
        if (!exists) {
            return null;
        }

        return db.collection(name);
    });
}

function mapNotification(document) {
    const createdAt =
        document?.created_at ||
        document?.createdAt ||
        document?._id?.getTimestamp?.() ||
        new Date();

    return {
        id: String(document?._id || ''),
        title: String(document?.title || document?.subject || 'Notification'),
        message: String(document?.message || document?.body || ''),
        type: String(document?.type || 'general'),
        read: Boolean(document?.read),
        created_at:
            createdAt instanceof Date
                ? createdAt.toISOString()
                : new Date(createdAt).toISOString(),
        cta_route:
            typeof document?.cta_route === 'string'
                ? document.cta_route
                : typeof document?.ctaRoute === 'string'
                    ? document.ctaRoute
                    : undefined,
    };
}

async function getNotifications(req, res) {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await syncCategoryAlertNotifications(db, user, email);

        const notificationsCollection = await getCollection(db, 'notifications');
        if (!notificationsCollection) {
            return res.status(200).json({ notifications: [], unread_count: 0 });
        }

        const ownershipFilter = buildOwnershipFilter(user, email);
        const rawNotifications = await notificationsCollection
            .find(ownershipFilter)
            .sort({ created_at: -1, createdAt: -1, _id: -1 })
            .limit(20)
            .toArray();

        const notifications = rawNotifications.map(mapNotification);
        const unreadCount = notifications.filter((notification) => !notification.read).length;

        return res.status(200).json({
            notifications,
            unread_count: unreadCount,
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to load notifications',
            'Error fetching notifications:'
        );
    }
}

async function markNotificationAsRead(req, res) {
    try {
        const email = getAuthEmail(req);
        const notificationId = String(req.params.id || '').trim();
        if (!notificationId) {
            return res.status(400).json({ message: 'Notification id is required' });
        }

        const db = await connectToMongoDB();
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const notificationsCollection = await getCollection(db, 'notifications');
        if (!notificationsCollection) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        const ownershipFilter = buildOwnershipFilter(user, email);
        const idFilter = ObjectId.isValid(notificationId)
            ? { _id: new ObjectId(notificationId) }
            : { _id: notificationId };

        const updateResult = await notificationsCollection.updateOne(
            { $and: [ownershipFilter, idFilter] },
            { $set: { read: true, updated_at: new Date() } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        return res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to update notification',
            'Error marking notification as read:'
        );
    }
}

async function markAllNotificationsAsRead(req, res) {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const notificationsCollection = await getCollection(db, 'notifications');
        if (!notificationsCollection) {
            return res.status(200).json({ message: 'No notifications to update' });
        }

        const ownershipFilter = buildOwnershipFilter(user, email);
        await notificationsCollection.updateMany(
            { $and: [ownershipFilter, { read: { $ne: true } }] },
            { $set: { read: true, updated_at: new Date() } }
        );

        return res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to update notifications',
            'Error marking all notifications as read:'
        );
    }
}

module.exports = {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
};
