const nodemailer = require('nodemailer');

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'testingnodemailer3@gmail.com',
        pass: 'obml zgob pycg dbei', // Use the correct password
    },
});

// Contact Form Controller
const handleContactFormSubmission = (req, res) => {
    const { name, email, message } = req.body;

    const mailOptions = {
        from: email,
        to: 'testingnodemailer3@gmail.com',
        subject: 'New Contact Form Submission',
        text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ message: 'Failed to send email' });
        }

        res.status(200).json({ message: 'Message sent successfully' });
    });
};

module.exports = {
    handleContactFormSubmission,
};
