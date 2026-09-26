const nodemailer = require('nodemailer');
const { Expo } = require('expo-server-sdk');
const { connectToMongoDB } = require('../config/database');

// price change event: { product_code, product_name, previous_price, new_price, observed_at (ISO), source }
// source is 'product_pricings_poll' for the scheduled check or 'webhook' for POST /price-alerts/events
// stale events (older than PRICE_EVENT_MAX_AGE_HOURS) and duplicates (same product + observed_at) are skipped

const HOUR = 60 * 60 * 1000;
let running = false;

function envNumber(name, fallback) {
    const value = Number(process.env[name]);
    return value > 0 ? value : fallback;
}

function money(value) {
    return `$${Number(value).toFixed(2)}`;
}

function describeCondition(alert) {
    if (alert.condition === 'percent_off_at_least') return `at least ${alert.threshold}% off`;
    return `price at or below ${money(alert.threshold)}`;
}

function evaluateAlert(alert, event) {
    if (alert.status !== 'enabled') return false;
    const sinceLast = alert.last_triggered_at ? Date.now() - new Date(alert.last_triggered_at).getTime() : Infinity;
    if (sinceLast < envNumber('PRICE_ALERT_COOLDOWN_HOURS', 24) * HOUR && alert.last_price_seen === event.new_price) return false;
    if (alert.condition === 'price_at_or_below') return event.new_price <= alert.threshold;
    if (alert.condition === 'percent_off_at_least' && event.previous_price > 0) {
        return ((event.previous_price - event.new_price) / event.previous_price) * 100 >= alert.threshold;
    }
    return false;
}

function cleanEvent(raw) {
    if (!raw || raw.product_code === undefined || raw.product_code === null) return null;
    const newPrice = Number(raw.new_price);
    const observed = new Date(raw.observed_at);
    if (!(newPrice > 0) || Number.isNaN(observed.getTime())) {
        console.log('Price event skipped (invalid price or date):', raw.product_code);
        return null;
    }
    if (Date.now() - observed.getTime() > envNumber('PRICE_EVENT_MAX_AGE_HOURS', 48) * HOUR) {
        console.log('skipping stale price for', raw.product_code, observed.toISOString());
        return null;
    }
    return {
        product_code: String(raw.product_code),
        product_name: String(raw.product_name || ''),
        previous_price: Number(raw.previous_price) > 0 ? Number(raw.previous_price) : null,
        new_price: newPrice,
        observed_at: observed.toISOString(),
        source: String(raw.source || 'unknown'),
    };
}

async function sendEmail(user, alert, event) {
    const from = process.env.SUPPORT_EMAIL_USER || process.env.EMAIL;
    const pass = process.env.SUPPORT_EMAIL_APP_PASSWORD || process.env.SUPPORT_EMAIL_PASS || process.env.PASS;
    if (!from || !pass) return { status: 'not_configured', error_code: 'email_not_configured' };

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: from, pass } });
    const link = `${process.env.APP_URL || 'http://localhost:8081'}/price-alerts`;
    try {
        await transporter.sendMail({
            from,
            to: user.email,
            subject: `Price alert: ${alert.product_name} is now ${money(event.new_price)}`,
            text: `${alert.product_name} matched your alert (${describeCondition(alert)}).\n\n` +
                `New price: ${money(event.new_price)}\nPrevious price: ${event.previous_price ? money(event.previous_price) : 'unknown'}\n` +
                `Seen at: ${event.observed_at}\n\nManage your alerts: ${link}`,
        });
        return { status: 'sent', error_code: null };
    } catch (error) {
        console.error('Price alert email failed:', error.message);
        return { status: 'failed', error_code: 'smtp_error' };
    }
}

async function sendPush(db, user, alert, event) {
    const tokens = (user.push_tokens || []).filter((token) => Expo.isExpoPushToken(token));
    if (tokens.length === 0) return { status: 'skipped', error_code: 'no_push_tokens' };

    const expo = new Expo();
    const messages = tokens.map((to) => ({
        to, sound: 'default', title: `Price alert: ${alert.product_name}`, body: `Now ${money(event.new_price)} (${describeCondition(alert)})`,
        data: { product_code: alert.product_code, route: '/price-alerts' },
    }));
    try {
        let failed = false;
        for (const chunk of expo.chunkPushNotifications(messages)) {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            for (let i = 0; i < tickets.length; i += 1) {
                if (tickets[i].status !== 'error') continue;
                failed = true;
                if (tickets[i].details && tickets[i].details.error === 'DeviceNotRegistered') {
                    await db.collection('users').updateOne({ email: user.email }, { $pull: { push_tokens: chunk[i].to } });
                }
            }
        }
        return failed ? { status: 'failed', error_code: 'expo_error' } : { status: 'sent', error_code: null };
    } catch (error) {
        console.error('Price alert push failed:', error.message);
        return { status: 'failed', error_code: 'expo_error' };
    }
}

async function mirrorDelivery(db, delivery) {
    const attempted_at = delivery.last_attempt_at || delivery.created_at;
    const last_delivery = { channel: delivery.channel, status: delivery.status, attempted_at, error_code: delivery.error_code };
    await db.collection('price_alerts').updateOne({ _id: delivery.alert_id }, { $set: { last_delivery } });
}

async function attemptDelivery(db, delivery, user, alert) {
    const event = delivery.price_event;
    const result = delivery.channel === 'email' ? await sendEmail(user, alert, event) : await sendPush(db, user, alert, event);
    const attempt = delivery.attempt_count + 1;
    const now = new Date();
    const changes = { status: result.status, attempt_count: attempt, last_attempt_at: now, next_retry_at: null, error_code: result.error_code };
    console.log('Price alert delivery attempt:', String(delivery._id), delivery.channel, 'attempt', attempt, result.status, result.error_code || '');

    if (result.status === 'failed' && attempt < delivery.max_attempts) {
        changes.status = 'retrying';
        changes.next_retry_at = new Date(now.getTime() + envNumber('NOTIFICATION_RETRY_BASE_MINUTES', 5) * 60 * 1000 * Math.pow(2, attempt - 1));
        console.log('Price alert delivery retry scheduled:', String(delivery._id), changes.next_retry_at.toISOString());
    } else if (result.status === 'failed') {
        changes.status = 'exhausted';
        console.error('Price alert delivery failed permanently', {
            delivery_id: String(delivery._id), alert_id: String(delivery.alert_id), channel: delivery.channel, error_code: changes.error_code,
        });
    }
    await db.collection('notification_deliveries').updateOne({ _id: delivery._id }, { $set: changes });
    await mirrorDelivery(db, { ...delivery, ...changes });
}

async function notifyUser(db, alert, event) {
    const user = await db.collection('users').findOne({ email: alert.user_email });
    if (!user) return;
    const prefs = (user.notification_preferences && user.notification_preferences.alert_types) || {};
    const priceAlertsOn = prefs.price_alerts !== false;

    for (const channel of ['email', 'push']) {
        const delivery = {
            alert_id: alert._id,
            user_email: alert.user_email,
            channel,
            status: 'skipped',
            attempt_count: 0,
            max_attempts: envNumber('NOTIFICATION_MAX_RETRIES', 3),
            last_attempt_at: null,
            next_retry_at: null,
            error_code: null,
            price_event: { product_code: event.product_code, previous_price: event.previous_price, new_price: event.new_price, observed_at: event.observed_at },
            created_at: new Date(),
        };
        if (!alert.channels || !alert.channels[channel]) delivery.error_code = 'channel_disabled_on_alert';
        else if (!priceAlertsOn || prefs[`${channel}_notifications`] === false) delivery.error_code = 'channel_disabled_by_preference';

        delivery._id = (await db.collection('notification_deliveries').insertOne(delivery)).insertedId;
        if (delivery.error_code) {
            console.log('Price alert delivery skipped:', String(delivery._id), channel, delivery.error_code);
            await mirrorDelivery(db, delivery);
        } else {
            await attemptDelivery(db, delivery, user, alert);
        }
    }

    if (priceAlertsOn && prefs.in_browser_notifications !== false) {
        await db.collection('notifications').insertOne({
            type: 'price_alert',
            title: `Price drop: ${alert.product_name}`,
            message: `${alert.product_name} is now ${money(event.new_price)} (${describeCondition(alert)}).`,
            read: false,
            related_product_ids: [alert.product_code],
            cta_route: '/(tabs)/price-alerts',
            deal_key: `price_alert:${alert._id}:${event.observed_at}`,
            email: alert.user_email, user_email: alert.user_email, userId: String(user._id), user_id: String(user._id),
            created_at: new Date(),
            updated_at: new Date(),
        });
    }
}

async function processPriceEvents(events) {
    const db = await connectToMongoDB();
    let accepted = 0;
    let skipped = 0;
    let triggeredCount = 0;

    for (const raw of events || []) {
        const event = cleanEvent(raw);
        if (!event) {
            skipped += 1;
            continue;
        }
        const eventId = `${event.product_code}:${event.observed_at}`;
        if (await db.collection('price_alert_events').findOne({ event_id: eventId })) {
            console.log('Price event skipped (duplicate):', eventId);
            skipped += 1;
            continue;
        }
        await db.collection('price_alert_events').insertOne({ event_id: eventId, created_at: new Date() });
        accepted += 1;

        const alerts = await db.collection('price_alerts').find({ product_code: event.product_code, status: 'enabled' }).toArray();
        for (const alert of alerts) {
            const triggered = evaluateAlert(alert, event);
            console.log(triggered ? 'alert triggered' : 'alert not triggered', String(alert._id), alert.condition, alert.threshold, 'price', event.new_price);
            const changes = { last_evaluated_at: new Date(), last_price_seen: event.new_price };
            if (triggered) changes.last_triggered_at = new Date();
            await db.collection('price_alerts').updateOne({ _id: alert._id }, { $set: changes });
            if (triggered) {
                triggeredCount += 1;
                await notifyUser(db, alert, event);
            }
        }
    }
    return { accepted, skipped, triggered: triggeredCount };
}

async function retryFailedDeliveries() {
    const db = await connectToMongoDB();
    const due = await db.collection('notification_deliveries').find({ status: 'retrying', next_retry_at: { $lte: new Date() } }).toArray();
    if (due.length > 0) console.log('Price alert deliveries due for retry:', due.length);

    for (const delivery of due) {
        const alert = await db.collection('price_alerts').findOne({ _id: delivery.alert_id });
        const user = await db.collection('users').findOne({ email: delivery.user_email });
        if (alert && user) await attemptDelivery(db, delivery, user, alert);
        else await db.collection('notification_deliveries').updateOne({ _id: delivery._id }, { $set: { status: 'exhausted', error_code: 'alert_or_user_missing' } });
    }
}

async function checkPriceAlerts() {
    if (running) {
        console.log('Price alert check skipped: previous run still going');
        return { accepted: 0, skipped: 0, triggered: 0 };
    }
    running = true;
    try {
        const db = await connectToMongoDB();
        const codes = await db.collection('price_alerts').distinct('product_code', { status: 'enabled' });
        console.log('checking price alerts for', codes.length, 'products');
        if (codes.length === 0) return { accepted: 0, skipped: 0, triggered: 0 };
        const numericCodes = codes.map(Number).filter((code) => !Number.isNaN(code));
        const rows = await db.collection('product_pricings')
            .find({ product_code: { $in: [...codes, ...numericCodes] } })
            .sort({ date: -1, created_at: -1 })
            .project({ product_code: 1, price: 1, date: 1, created_at: 1 })
            .toArray();

        const events = {};
        for (const row of rows) {
            const code = String(row.product_code);
            const price = Number(row.price);
            if (!(price > 0)) continue;
            if (!events[code]) {
                events[code] = { product_code: code, previous_price: null, new_price: price, observed_at: row.date || row.created_at, source: 'product_pricings_poll' };
            } else if (events[code].previous_price === null && price !== events[code].new_price) {
                events[code].previous_price = price;
            }
        }
        const result = await processPriceEvents(Object.values(events));
        await retryFailedDeliveries();
        console.log(`done checking ${codes.length} products: ${result.accepted} new events (${result.skipped} skipped), ${result.triggered} alerts triggered`);
        return result;
    } finally {
        running = false;
    }
}

module.exports = { evaluateAlert, processPriceEvents, retryFailedDeliveries, checkPriceAlerts };
