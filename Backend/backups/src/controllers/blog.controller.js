const { connectToMongoDB, getDb } = require('../config/database');

// Blog Controller
const getAllBlogs = async (req, res) => {
    try {
        const db = getDb();
        const blogs = await db.collection('blogs').find().sort({ date: -1 }).toArray();
        res.status(200).json(blogs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching blogs' });
    }
};

const submitBlog = async (req, res, db) => {
    const { heading, date, description, user } = req.body;

    try {
        const db = await connectToMongoDB();
        // Check if database is initialized
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        // Insert blog data into the 'blogs' collection
        const result = await db.collection('blogs').insertOne({
            heading,
            description,
            date,
            user,  // The user who submitted the blog
            created_at: new Date()  // Timestamp of when the blog was created
        });

        // Send back a success response with the inserted blog ID
        res.status(201).json({ message: 'Blog data received and saved successfully', blogId: result.insertedId });
    } catch (error) {
        console.error('Error submitting blog:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllBlogs,
    submitBlog
};
