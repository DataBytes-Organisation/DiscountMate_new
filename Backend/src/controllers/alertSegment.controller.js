const jwt = require("jsonwebtoken");
const { connectToMongoDB } = require("../config/database");
const {
    CATEGORY_CATALOG,
    getCatalogEntryByKey,
    buildOwnershipFilter,
    syncCategoryAlertNotifications,
    getTriggeredCountsByCategory,
} = require("../utils/alertSegments");

function createAuthError(message = "Invalid token, please log in again") {
    const error = new Error(message);
    error.statusCode = 401;
    return error;
}

function getAuthEmail(req) {
    const token = req.headers.authorization && req.headers.authorization.split(" ")[1];
    if (!token) {
        throw createAuthError("No token provided, please log in");
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.email;
    } catch (error) {
        throw createAuthError("Invalid token, please log in again");
    }
}

function handleControllerError(res, error, fallbackMessage, logPrefix) {
    if (error?.statusCode === 401) {
        return res.status(401).json({
            message: error.message || "Invalid token, please log in again",
        });
    }

    console.error(logPrefix, error);
    return res.status(500).json({ message: fallbackMessage });
}

async function getAlertSegments(req, res) {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        const user = await db.collection("users").findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await syncCategoryAlertNotifications(db, user, email);

        const ownershipFilter = buildOwnershipFilter(user, email);
        const savedSegments = await db
            .collection("alert_segments")
            .find(ownershipFilter)
            .project({ category_key: 1, category_label: 1, active: 1 })
            .toArray();

        const savedSegmentMap = new Map();
        savedSegments.forEach((segment) => {
            const categoryKey = String(segment?.category_key || "").trim();
            if (!categoryKey) {
                return;
            }

            savedSegmentMap.set(categoryKey, Boolean(segment?.active));
        });

        const triggeredCounts = await getTriggeredCountsByCategory(db, user, email);
        const segments = CATEGORY_CATALOG.map((category) => ({
            categoryKey: category.key,
            categoryLabel: category.label,
            active: savedSegmentMap.get(category.key) === true,
            triggeredCount: triggeredCounts.get(category.key) || 0,
        }));

        return res.status(200).json({
            summary: {
                totalCategories: CATEGORY_CATALOG.length,
                activeCategories: segments.filter((segment) => segment.active).length,
                triggeredCategories: segments.filter((segment) => segment.triggeredCount > 0).length,
            },
            segments,
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            "Failed to load alert segments",
            "Error fetching alert segments:"
        );
    }
}

async function updateAlertSegment(req, res) {
    try {
        const email = getAuthEmail(req);
        const categoryKey = String(req.params.categoryKey || "").trim();
        const active = req.body?.active;

        if (!categoryKey) {
            return res.status(400).json({ message: "Category key is required" });
        }

        if (typeof active !== "boolean") {
            return res.status(400).json({ message: "Active state must be provided" });
        }

        const category = getCatalogEntryByKey(categoryKey);
        if (!category) {
            return res.status(404).json({ message: "Alert category not found" });
        }

        const db = await connectToMongoDB();
        const user = await db.collection("users").findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const ownershipFilter = buildOwnershipFilter(user, email);
        await db.collection("alert_segments").updateOne(
            {
                $and: [ownershipFilter, { category_key: category.key }],
            },
            {
                $set: {
                    category_key: category.key,
                    category_label: category.label,
                    active,
                    updatedAt: new Date(),
                    email,
                    user_email: email,
                    userId: user?._id ? String(user._id) : undefined,
                    user_id: user?._id ? String(user._id) : undefined,
                },
            },
            { upsert: true }
        );

        if (active) {
            await syncCategoryAlertNotifications(db, user, email);
        }

        const triggeredCounts = await getTriggeredCountsByCategory(db, user, email);

        return res.status(200).json({
            segment: {
                categoryKey: category.key,
                categoryLabel: category.label,
                active,
                triggeredCount: triggeredCounts.get(category.key) || 0,
            },
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            "Failed to update alert segment",
            "Error updating alert segment:"
        );
    }
}

module.exports = {
    getAlertSegments,
    updateAlertSegment,
};
