const nodemailer = require("nodemailer");

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "testingnodemailer3@gmail.com",
    pass: "obml zgob pycg dbei",
  },
});

// Contact form submission controller (No DB needed)
exports.submitContactForm = (req, res) => {
  const { name, email, message } = req.body;

  const mailOptions = {
    from: email, // Sender's email address (from the form)
    to: "testingnodemailer3@gmail.com", // Email where contact form submissions go
    subject: "New Contact Form Submission",
    text: `You have a new contact form submission:\n\nName: ${name}\nEmail: ${email}\nMessage: ${message}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      return res.status(500).json({ message: "Failed to send email" });
    }

    res.status(200).json({ message: "Feedback received and email sent" });
  });
};
