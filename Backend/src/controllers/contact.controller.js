const nodemailer = require('nodemailer');
const { getDb } = require('../config/database');

const SUPPORT_EMAIL =
    process.env.SUPPORT_EMAIL || process.env.EMAIL || 'supportdiscountmate@gmail.com';

function createReferenceNumber() {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(
        2,
        '0'
    )}${String(date.getDate()).padStart(2, '0')}`;
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SUP-${stamp}-${suffix}`;
}

function createTransporter() {
    if (!process.env.EMAIL || !process.env.PASS) {
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASS,
        },
    });
}

async function saveSupportRequest({
    referenceNumber,
    name,
    email,
    topic,
    subject,
    message,
    attachment,
    emailStatus,
}) {
    try {
        const db = getDb();
        await db.collection('support_requests').insertOne({
            referenceNumber,
            name,
            email,
            topic,
            subject,
            message,
            supportEmail: SUPPORT_EMAIL,
            emailStatus,
            status: 'received',
            attachment: attachment
                ? {
                      originalName: attachment.originalname,
                      mimeType: attachment.mimetype,
                      size: attachment.size,
                      dataBase64: attachment.buffer.toString('base64'),
                  }
                : null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    } catch (error) {
        console.error('Error saving support request:', error);
    }
}

function supportResponse({ referenceNumber, replyToEmail, emailStatus }) {
    return {
        message: 'Your support request was received.',
        referenceNumber,
        replyToEmail,
        expectedResponseTime: '24-48 hours',
        supportEmail: SUPPORT_EMAIL,
        emailStatus,
    };
}

// Contact Form Controller
const handleContactFormSubmission = async (req, res) => {
    const { name, email, subject, topic, message } = req.body;

    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim();
    const trimmedSubject = String(subject || '').trim();
    const trimmedTopic = String(topic || '').trim();
    const trimmedMessage = String(message || '').trim();
    const referenceNumber = createReferenceNumber();
    const attachment = req.file || null;

    if (!trimmedName || !trimmedEmail || !trimmedTopic || !trimmedMessage) {
        return res
            .status(400)
            .json({ message: 'Name, email, topic, and message are required.' });
    }

    const transporter = createTransporter();
    if (!transporter) {
        await saveSupportRequest({
            referenceNumber,
            name: trimmedName,
            email: trimmedEmail,
            topic: trimmedTopic,
            subject: trimmedSubject,
            message: trimmedMessage,
            attachment,
            emailStatus: 'not_configured',
        });

        return res.status(202).json(
            supportResponse({
                referenceNumber,
                replyToEmail: trimmedEmail,
                emailStatus: 'not_configured',
            })
        );
    }

    const mailOptions = {
        from: SUPPORT_EMAIL,
        replyTo: trimmedEmail,
        to: SUPPORT_EMAIL,
        subject: trimmedSubject
            ? `[${referenceNumber}] ${trimmedSubject}`
            : `[${referenceNumber}] New Contact Form Submission`,
        text: `Reference Number: ${referenceNumber}\nName: ${trimmedName}\nEmail: ${trimmedEmail}\nTopic: ${trimmedTopic}\n${
            trimmedSubject ? `Subject: ${trimmedSubject}\n` : ''
        }Message: ${trimmedMessage}`,
        attachments: attachment
            ? [
                  {
                      filename: attachment.originalname,
                      content: attachment.buffer,
                      contentType: attachment.mimetype,
                  },
              ]
            : [],
    };

    transporter.sendMail(mailOptions, async (error) => {
        if (error) {
            console.error('Error sending email:', error);
            await saveSupportRequest({
                referenceNumber,
                name: trimmedName,
                email: trimmedEmail,
                topic: trimmedTopic,
                subject: trimmedSubject,
                message: trimmedMessage,
                attachment,
                emailStatus: 'failed',
            });

            return res.status(202).json(
                supportResponse({
                    referenceNumber,
                    replyToEmail: trimmedEmail,
                    emailStatus: 'failed',
                })
            );
        }

        await saveSupportRequest({
            referenceNumber,
            name: trimmedName,
            email: trimmedEmail,
            topic: trimmedTopic,
            subject: trimmedSubject,
            message: trimmedMessage,
            attachment,
            emailStatus: 'sent',
        });

        res.status(200).json(
            supportResponse({
                referenceNumber,
                replyToEmail: trimmedEmail,
                emailStatus: 'sent',
            })
        );
    });
};

module.exports = {
    handleContactFormSubmission,
};
