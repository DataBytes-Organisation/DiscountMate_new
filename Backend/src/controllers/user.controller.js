
require('dotenv').config();
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const User = require('../schemas/models');
const { connectToMongoDB } = require('../config/database');

const PASSWORD_SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9\s]/;
const AU_POSTCODE_REGEX = /^\d{4}$/;
const AU_NATIONAL_NUMBER_REGEX = /^(4\d{8}|[2378]\d{8})$/;
const ADDRESS_SUGGESTION_CACHE = new Map();
const ADDRESS_SUGGESTION_CACHE_TTL_MS = 15 * 60 * 1000;

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

function validatePasswordStrength(password) {
    if (String(password || '').length < 8) {
        return 'Password must be at least 8 characters long';
    }

    if (!PASSWORD_SPECIAL_CHARACTER_REGEX.test(String(password || ''))) {
        return 'Password must include at least one special character';
    }

    return null;
}

function normalizeAustralianPhoneNumber(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
        return '';
    }

    const digits = rawValue.replace(/\D/g, '');
    let nationalNumber = '';

    if (digits.startsWith('61') && digits.length === 11) {
        nationalNumber = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length === 10) {
        nationalNumber = digits.slice(1);
    } else {
        return null;
    }

    if (!AU_NATIONAL_NUMBER_REGEX.test(nationalNumber)) {
        return null;
    }

    if (nationalNumber.startsWith('4')) {
        return `+61 ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
    }

    return `+61 ${nationalNumber.slice(0, 1)} ${nationalNumber.slice(1, 5)} ${nationalNumber.slice(5)}`;
}

function trimTrailingAustralia(value) {
    return String(value || '')
        .replace(/,\s*Australia\s*$/i, '')
        .trim();
}

function formatAddressSuggestion(result) {
    if (!result || result.country_code && String(result.country_code).toLowerCase() !== 'au') {
        return null;
    }

    const label = trimTrailingAustralia(result.display_name);
    if (!label) {
        return null;
    }

    const address = result.address || {};

    return {
        label,
        address: label,
        postcode: address.postcode || '',
        state: address.state_code
            ? String(address.state_code).toUpperCase()
            : address.state || '',
        suburb:
            address.suburb ||
            address.city_district ||
            address.city ||
            address.town ||
            address.village ||
            '',
        latitude: result.lat ? String(result.lat) : undefined,
        longitude: result.lon ? String(result.lon) : undefined,
    };
}

function dedupeAddressSuggestions(suggestions) {
    const seen = new Set();

    return suggestions.filter((suggestion) => {
        const key = String(suggestion?.label || '').toLowerCase();
        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function serializeProfileImage(profileImage) {
    if (!profileImage || !profileImage.mime || !profileImage.content) {
        return null;
    }

    if (typeof profileImage.content === 'string') {
        return `data:${profileImage.mime};base64,${profileImage.content}`;
    }

    if (Buffer.isBuffer(profileImage.content)) {
        return `data:${profileImage.mime};base64,${profileImage.content.toString('base64')}`;
    }

    if (profileImage.content?.type === 'Buffer' && Array.isArray(profileImage.content.data)) {
        return `data:${profileImage.mime};base64,${Buffer.from(profileImage.content.data).toString('base64')}`;
    }

    return null;
}

function deserializeProfileImage(profileImage) {
    if (!profileImage || !profileImage.content) {
        return null;
    }

    if (typeof profileImage.content === 'string') {
        return Buffer.from(profileImage.content, 'base64');
    }

    if (Buffer.isBuffer(profileImage.content)) {
        return profileImage.content;
    }

    if (profileImage.content?.type === 'Buffer' && Array.isArray(profileImage.content.data)) {
        return Buffer.from(profileImage.content.data);
    }

    return null;
}

function formatMemberSince(user) {
    const rawDate = user?.createdAt || user?.created_at || user?._id?.getTimestamp?.();
    const parsed = rawDate ? new Date(rawDate) : null;

    if (!parsed || Number.isNaN(parsed.getTime())) {
        return 'Recently joined';
    }

    return parsed.toLocaleDateString('en-AU', {
        month: 'short',
        year: 'numeric',
    });
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

async function getActiveAlertsCount(db, user, email) {
    const alertOwnership = buildOwnershipFilter(user, email);
    return db.collection('alert_segments').countDocuments({
        $and: [alertOwnership, { active: { $ne: false } }],
    });
}

function buildProfileResponse(user, activeAlerts = 0) {
    return {
        user_fname: user.user_fname || '',
        user_lname: user.user_lname || '',
        email: user.email || '',
        address: user.address || '',
        phone_number: user.phone_number || '',
        postcode: user.postcode || '',
        admin: user.admin,
        member_since: formatMemberSince(user),
        subscription_plan: user?.subscription?.plan || user?.subscriptionPlan || 'free',
        total_saved: Number(user.totalSaved || 0),
        shopping_trips: Number(user.shoppingTrips || 0),
        active_alerts: Number(activeAlerts || 0),
        shopping_lists: Number(user.shoppingLists || 0),
        profile_image: serializeProfileImage(user.profile_image),
        email_verified:
            typeof user.email_verified === 'boolean'
                ? user.email_verified
                : Boolean(user.email),
        phone_verified:
            typeof user.phone_verified === 'boolean'
                ? user.phone_verified
                : Boolean(user.phone_number),
    };
}

function getDefaultNotificationPreferences() {
    return {
        alert_types: {
            price_alerts: true,
            weekly_summary: true,
            in_browser_notifications: true,
        },
    };
}

const SUBSCRIPTION_PLAN_CONFIG = {
    free: {
        key: 'free',
        label: 'Free',
        price_label: '$0',
        price_suffix: 'forever',
        badge: null,
        features: [
            'Up to 5 active price and category alerts',
            'Basic savings summary',
            'Up to 3 saved lists',
            'Basic nearby store access',
        ],
        limits: {
            price_alerts: 5,
            saved_lists: 3,
        },
    },
    premium: {
        key: 'premium',
        label: 'Premium',
        price_label: '$4.99',
        price_suffix: '/ month',
        badge: 'Most Popular',
        features: [
            'Unlimited price and category alerts',
            'Expanded dashboard insights and history',
            'Priority deal notifications',
            'Extended nearby coverage',
            'Early access to new features',
        ],
        limits: {
            price_alerts: null,
            saved_lists: null,
        },
    },
    family: {
        key: 'family',
        label: 'Family',
        price_label: '$9.99',
        price_suffix: '/ month',
        badge: null,
        features: [
            'Everything in Premium',
            'Household-friendly plan management',
            'Shared planning tools as they roll out',
            'Family-focused savings visibility',
            'Priority support access',
        ],
        limits: {
            price_alerts: null,
            saved_lists: null,
        },
    },
};

function normalizeSubscriptionPlan(plan) {
    const normalized = String(plan || '').trim().toLowerCase();
    if (normalized === 'premium' || normalized === 'family') {
        return normalized;
    }

    return 'free';
}

function getSubscriptionPlanConfig(plan) {
    return SUBSCRIPTION_PLAN_CONFIG[normalizeSubscriptionPlan(plan)];
}

function buildSubscriptionPlansResponse(currentPlan) {
    const activePlan = normalizeSubscriptionPlan(currentPlan);

    return Object.values(SUBSCRIPTION_PLAN_CONFIG).map((plan) => ({
        key: plan.key,
        label: plan.label,
        price_label: plan.price_label,
        price_suffix: plan.price_suffix,
        badge: plan.badge,
        current: plan.key === activePlan,
        features: plan.features,
        limits: plan.limits,
    }));
}

function buildSubscriptionUsage(plan, usageCounts) {
    const config = getSubscriptionPlanConfig(plan);

    return {
        price_alerts: {
            label: 'Price Alerts',
            used: Number(usageCounts?.price_alerts || 0),
            limit: config.limits.price_alerts,
        },
        saved_lists: {
            label: 'Saved Lists',
            used: Number(usageCounts?.saved_lists || 0),
            limit: config.limits.saved_lists,
        },
    };
}

function normalizeNotificationPreferences(preferences) {
    const defaults = getDefaultNotificationPreferences();
    const alertTypes = preferences?.alert_types || preferences?.alertTypes || {};

    return {
        alert_types: {
            price_alerts:
                typeof alertTypes.price_alerts === 'boolean'
                    ? alertTypes.price_alerts
                    : typeof alertTypes.priceAlerts === 'boolean'
                        ? alertTypes.priceAlerts
                        : defaults.alert_types.price_alerts,
            weekly_summary:
                typeof alertTypes.weekly_summary === 'boolean'
                    ? alertTypes.weekly_summary
                    : typeof alertTypes.weeklySummary === 'boolean'
                        ? alertTypes.weeklySummary
                        : defaults.alert_types.weekly_summary,
            in_browser_notifications:
                typeof alertTypes.in_browser_notifications === 'boolean'
                    ? alertTypes.in_browser_notifications
                    : typeof alertTypes.inBrowserNotifications === 'boolean'
                        ? alertTypes.inBrowserNotifications
                        : typeof alertTypes.browserNotifications === 'boolean'
                            ? alertTypes.browserNotifications
                            : defaults.alert_types.in_browser_notifications,
        },
    };
}

// Signup Controller
const signup = async (req, res) => {
    const { email, password, verifyPassword, user_fname, user_lname, address, phone_number, admin } = req.body;

    try {
        const normalizedEmail = (email || '').trim().toLowerCase();

        if (!normalizedEmail) {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!password || !verifyPassword) {
            return res.status(400).json({ message: 'Password and verifyPassword are required' });
        }

        // Establish MongoDB connection and get the db object
        const db = await connectToMongoDB(); // Await the connection to get the db object

        // Check if the passwords match
        if (password !== verifyPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the new user object to insert
        const user = {
            // `account_user_name` is uniquely indexed in prod; if omitted, MongoDB
            // indexes missing fields as null and will reject the 2nd insert.
            // Use email as a stable unique username for now.
            account_user_name: normalizedEmail,
            email: normalizedEmail,
            encrypted_password: hashedPassword,
            user_fname,
            user_lname,
            address,
            phone_number,
            admin: admin || false,
        };

        // Insert the user into the database (using native MongoDB method)
        const result = await db.collection('users').insertOne(user);

        // Send a success response
        res.status(201).json({ message: 'User created successfully', userId: result.insertedId });

    } catch (error) {
        console.error('Error signing up user:', error);
        res.status(500).json({ message: 'Error signing up user' });
    }
};

// Defining the limiter
const { rateLimit } = require("express-rate-limit");

// Only allows for one request every 5 minutes per IP
const limiter = rateLimit({

windowMs: 5 * 60 * 1000,

limit: 1,

message: "Too many requests. Please try again later.",

standardHeaders: true,

legacyHeaders: false,

});

// Signin Controller
const signin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const db = await connectToMongoDB();


        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        const user = await db.collection('users').findOne({ email: email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.encrypted_password);

        if (isMatch) {
            const token = jwt.sign({ email, admin: user.admin }, process.env.JWT_SECRET, { expiresIn: '1h' });
            return res.status(200).json({ message: 'Signin successful', token, admin: user.admin });
        } else {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error signing in user:', error);
        res.status(500).json({ message: 'Error signing in user' });
    }
};


const getProfile = async (req, res) => {
    try {
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided, please log in' });
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Invalid token, please log in again' });
            }

            const email = decoded.email;

            const db = await connectToMongoDB();
            if (!db) {
                return res.status(500).json({ message: 'Database connection failed' });
            }

            const user = await db.collection('users').findOne(
                { email },
                { projection: { encrypted_password: 0 } }
            );

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const activeAlerts = await getActiveAlertsCount(db, user, email);

            return res.status(200).json(buildProfileResponse(user, activeAlerts));
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const email = getAuthEmail(req);

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const existingUser = await db.collection('users').findOne({ email });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const {
            firstName,
            lastName,
            phoneNumber,
            address,
            postcode,
        } = req.body || {};

        const nextFirstName =
            typeof firstName === 'string' ? firstName.trim() : existingUser.user_fname || '';
        const nextLastName =
            typeof lastName === 'string' ? lastName.trim() : existingUser.user_lname || '';
        const nextAddress =
            typeof address === 'string' ? address.trim() : existingUser.address || '';
        const nextPostcode =
            typeof postcode === 'string' ? postcode.trim() : existingUser.postcode || '';

        let nextPhoneNumber = existingUser.phone_number || '';
        if (typeof phoneNumber === 'string') {
            const normalizedPhoneNumber = normalizeAustralianPhoneNumber(phoneNumber);
            if (normalizedPhoneNumber === null) {
                return res.status(400).json({
                    message:
                        'Enter a valid Australian phone number, for example 0412 345 678 or +61 412 345 678',
                });
            }

            nextPhoneNumber = normalizedPhoneNumber;
        }

        if (nextFirstName && nextFirstName.length < 2) {
            return res.status(400).json({
                message: 'First name should be at least 2 characters long',
            });
        }

        if (nextLastName && nextLastName.length < 2) {
            return res.status(400).json({
                message: 'Last name should be at least 2 characters long',
            });
        }

        if (nextAddress && nextAddress.length < 5) {
            return res.status(400).json({
                message: 'Address should be at least 5 characters long',
            });
        }

        if (nextPostcode && !AU_POSTCODE_REGEX.test(nextPostcode)) {
            return res.status(400).json({
                message: 'Postcode must be a 4-digit Australian postcode',
            });
        }

        const updates = {
            user_fname: nextFirstName,
            user_lname: nextLastName,
            phone_number: nextPhoneNumber,
            address: nextAddress,
            postcode: nextPostcode,
            updatedAt: new Date(),
        };

        await db.collection('users').updateOne(
            { email },
            { $set: updates }
        );

        const refreshedUser = await db.collection('users').findOne(
            { email },
            { projection: { encrypted_password: 0 } }
        );

        const activeAlerts = await getActiveAlertsCount(db, refreshedUser, email);

        return res.status(200).json({
            message: 'Profile updated successfully',
            profile: buildProfileResponse(refreshedUser, activeAlerts),
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to update profile',
            'Error updating profile:'
        );
    }
};

const changePassword = async (req, res) => {
    try {
        const email = getAuthEmail(req);

        const {
            currentPassword,
            newPassword,
            confirmNewPassword,
        } = req.body || {};

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({
                message: 'Current password, new password, and confirmation are required',
            });
        }

        if (String(newPassword).length < 8) {
            return res.status(400).json({
                message: 'New password must be at least 8 characters long',
            });
        }

        const passwordValidationMessage = validatePasswordStrength(newPassword);
        if (passwordValidationMessage) {
            return res.status(400).json({ message: passwordValidationMessage });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.encrypted_password || '');
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const sameAsCurrent = await bcrypt.compare(newPassword, user.encrypted_password || '');
        if (sameAsCurrent) {
            return res.status(400).json({
                message: 'New password must be different from your current password',
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.collection('users').updateOne(
            { email },
            {
                $set: {
                    encrypted_password: hashedPassword,
                    updatedAt: new Date(),
                },
            }
        );

        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to update password',
            'Error changing password:'
        );
    }
};

const getAddressSuggestions = async (req, res) => {
    try {
        getAuthEmail(req);

        const query = String(req.query.q || '').trim();
        if (query.length < 3) {
            return res.status(200).json({ suggestions: [] });
        }

        const cacheKey = query.toLowerCase();
        const cachedEntry = ADDRESS_SUGGESTION_CACHE.get(cacheKey);
        if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
            return res.status(200).json({ suggestions: cachedEntry.suggestions });
        }

        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: query,
                countrycodes: 'au',
                format: 'jsonv2',
                addressdetails: 1,
                limit: 5,
            },
            headers: {
                'User-Agent': 'DiscountMate/1.0 (profile address lookup)',
                'Accept-Language': 'en-AU,en;q=0.9',
            },
            timeout: 5000,
        });

        const suggestions = dedupeAddressSuggestions(
            (Array.isArray(response.data) ? response.data : [])
                .map(formatAddressSuggestion)
                .filter(Boolean)
        );

        ADDRESS_SUGGESTION_CACHE.set(cacheKey, {
            suggestions,
            expiresAt: Date.now() + ADDRESS_SUGGESTION_CACHE_TTL_MS,
        });

        return res.status(200).json({ suggestions });
    } catch (error) {
        if (error?.statusCode === 401) {
            return res.status(401).json({
                message: error.message || 'Invalid token, please log in again',
            });
        }

        console.error('Error fetching address suggestions:', error?.message || error);
        return res.status(502).json({
            message: 'Unable to load Australian address suggestions right now',
        });
    }
};

const getNotificationPreferences = async (req, res) => {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne(
            { email },
            { projection: { notification_preferences: 1 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            notification_preferences: normalizeNotificationPreferences(user.notification_preferences),
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to load notification preferences',
            'Error fetching notification preferences:'
        );
    }
};

const updateNotificationPreferences = async (req, res) => {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const nextPreferences = normalizeNotificationPreferences(req.body?.notification_preferences);

        await db.collection('users').updateOne(
            { email },
            {
                $set: {
                    notification_preferences: nextPreferences,
                    updatedAt: new Date(),
                },
            }
        );

        return res.status(200).json({
            message: 'Notification preferences updated successfully',
            notification_preferences: nextPreferences,
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to update notification preferences',
            'Error updating notification preferences:'
        );
    }
};

const getSubscription = async (req, res) => {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne(
            { email },
            {
                projection: {
                    subscription: 1,
                    subscriptionPlan: 1,
                    shoppingLists: 1,
                },
            }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentPlan = normalizeSubscriptionPlan(
            user?.subscription?.plan || user?.subscriptionPlan || 'free'
        );
        const currentConfig = getSubscriptionPlanConfig(currentPlan);
        const activeAlerts = await getActiveAlertsCount(db, user, email);
        const shoppingLists = Number(user?.shoppingLists || 0);

        return res.status(200).json({
            current_plan: currentPlan,
            current_plan_label: currentConfig.label,
            current_price_label: currentConfig.price_label,
            current_price_suffix: currentConfig.price_suffix,
            plans: buildSubscriptionPlansResponse(currentPlan),
            usage: buildSubscriptionUsage(currentPlan, {
                price_alerts: activeAlerts,
                saved_lists: shoppingLists,
            }),
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to load subscription',
            'Error fetching subscription:'
        );
    }
};

const updateSubscription = async (req, res) => {
    try {
        const email = getAuthEmail(req);
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const nextPlan = normalizeSubscriptionPlan(req.body?.plan);
        const nextConfig = getSubscriptionPlanConfig(nextPlan);

        await db.collection('users').updateOne(
            { email },
            {
                $set: {
                    subscription: {
                        plan: nextPlan,
                        updatedAt: new Date(),
                    },
                    subscriptionPlan: nextPlan,
                    updatedAt: new Date(),
                },
            }
        );

        const activeAlerts = await getActiveAlertsCount(db, user, email);
        const shoppingLists = Number(user?.shoppingLists || 0);

        return res.status(200).json({
            message: 'Subscription updated successfully',
            current_plan: nextPlan,
            current_plan_label: nextConfig.label,
            current_price_label: nextConfig.price_label,
            current_price_suffix: nextConfig.price_suffix,
            plans: buildSubscriptionPlansResponse(nextPlan),
            usage: buildSubscriptionUsage(nextPlan, {
                price_alerts: activeAlerts,
                saved_lists: shoppingLists,
            }),
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to update subscription',
            'Error updating subscription:'
        );
    }
};

const deleteAccount = async (req, res) => {
    try {
        const email = getAuthEmail(req);

        const { confirmDelete } = req.body || {};
        if (confirmDelete !== true) {
            return res.status(400).json({
                message: 'Please confirm account deletion before continuing',
            });
        }

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const ownershipFilter = buildOwnershipFilter(user, email);
        const relatedCollections = [
            'alert_segments',
            'notifications',
            'expiry_items',
            'shopping_trips',
            'shopping_lists',
        ];

        await Promise.all(
            relatedCollections.map(async (collectionName) => {
                const exists = await db.listCollections({ name: collectionName }).hasNext();
                if (exists) {
                    await db.collection(collectionName).deleteMany(ownershipFilter);
                }
            })
        );

        await db.collection('users').deleteOne({ email });

        return res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'Failed to delete account',
            'Error deleting account:'
        );
    }
};

const updateProfileImage = async (req, res) => {
    try {
        const email = getAuthEmail(req);

        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const profileImage = {
            mime: file.mimetype || 'application/octet-stream',
            content: file.buffer.toString('base64'),
        };

        const updateResult = await db.collection('users').updateOne(
            { email },
            {
                $set: {
                    profile_image: profileImage,
                    updatedAt: new Date(),
                },
            }
        );

        if (updateResult.matchedCount !== 1) {
            return res.status(500).json({ message: 'Failed to update profile image' });
        }

        return res.status(200).json({
            message: 'Profile image updated successfully',
            profile_image: serializeProfileImage(profileImage),
        });
    } catch (error) {
        if (error?.statusCode === 401) {
            return res.status(401).json({
                message: error.message || 'Invalid token, please log in again',
            });
        }

        console.error('Error updating profile image:', error);
        res.status(500).json({
            message:
                process.env.NODE_ENV === 'production'
                    ? 'Internal Server Error'
                    : error?.message || 'Internal Server Error',
        });
    }
};

// Get Profile Image
const getProfileImage = async (req, res) => {
    try {
      const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const email = decoded.email;

      const db = await connectToMongoDB();
      const user = await db.collection('users').findOne({ email });

      if (!user || !user.profile_image) {
        return res.status(404).json({ message: 'Profile image not found' });
      }

      const imageBuffer = deserializeProfileImage(user.profile_image);
      if (!imageBuffer) {
        return res.status(404).json({ message: 'Profile image not found' });
      }

      res.setHeader('Content-Type', user.profile_image.mime || 'application/octet-stream');
      return res.status(200).send(imageBuffer);
    } catch (error) {
      console.error('Error fetching profile image:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  };

module.exports = {
    signup,
    signin,
    getProfile,
    updateProfile,
    changePassword,
    getAddressSuggestions,
    getNotificationPreferences,
    updateNotificationPreferences,
    getSubscription,
    updateSubscription,
    deleteAccount,
    updateProfileImage,
    getProfileImage,
    signupLimiter: limiter
};
