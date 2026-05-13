const jwt = require('jsonwebtoken');
const { connectToMongoDB } = require('../config/database');
const {
    getSavedListsForUser,
    getSavedListById,
    formatSavedListSummary,
    calculateListPricingSnapshot,
    applyOwnershipFields,
    formatSnapshotResponse,
    normalizeDashboardRetailer,
} = require('../utils/savedLists');

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

function handleControllerError(res, error, fallbackMessage) {
    if (error?.statusCode === 401) {
        return res.status(401).json({
            message: error.message || 'Invalid token, please log in again',
        });
    }

    console.error('Error handling saved lists:', error);
    return res.status(500).json({ message: fallbackMessage });
}

async function getSavedLists(req, res) {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const lists = await getSavedListsForUser(db, user, email);

        return res.status(200).json({
            lists: lists.map(formatSavedListSummary),
        });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to load saved lists');
    }
}

async function repriceSavedList(req, res) {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const list = await getSavedListById(db, user, email, req.params?.id);
        if (!list) {
            return res.status(404).json({ message: 'Saved list not found' });
        }

        const pricingSummary = await calculateListPricingSnapshot(
            db,
            list,
            req.body?.selectedRetailer || user?.dashboard_preferences?.selected_dashboard_retailer
        );

        if (pricingSummary.error) {
            return res.status(409).json({ message: pricingSummary.error });
        }

        const now = new Date();
        const snapshotDocument = applyOwnershipFields(
            {
                saved_list_id: String(list._id),
                saved_list_name: list.name || 'Saved List',
                selected_retailer: pricingSummary.selectedRetailer,
                retailer_totals: pricingSummary.retailerTotals,
                cheapest_retailer: pricingSummary.cheapestRetailer,
                cheapest_total: pricingSummary.cheapestTotal,
                selected_total: pricingSummary.selectedTotal,
                total_saved: pricingSummary.totalSaved,
                savings_rate: pricingSummary.savingsRate,
                item_count: pricingSummary.itemCount,
                createdAt: now,
                updatedAt: now,
            },
            user,
            email
        );

        const insertResult = await db
            .collection('list_pricing_snapshots')
            .insertOne(snapshotDocument);

        const selectedRetailer =
            normalizeDashboardRetailer(pricingSummary.selectedRetailer) ||
            normalizeDashboardRetailer(req.body?.selectedRetailer);

        await db.collection('users').updateOne(
            { email },
            {
                $set: {
                    dashboard_preferences: {
                        selected_dashboard_list_id: String(list._id),
                        selected_dashboard_retailer: selectedRetailer,
                        updatedAt: now,
                    },
                    shoppingLists: await db.collection('saved_lists').countDocuments({
                        $or: [
                            { email },
                            { user_email: email },
                            { userEmail: email },
                            { user_id: String(user._id) },
                            { userId: String(user._id) },
                        ],
                    }),
                    updatedAt: now,
                },
            }
        );

        return res.status(200).json({
            message: 'Saved list repriced successfully',
            snapshot: formatSnapshotResponse({
                ...snapshotDocument,
                _id: insertResult.insertedId,
            }),
        });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to reprice saved list');
    }
}

module.exports = {
    getSavedLists,
    repriceSavedList,
};
