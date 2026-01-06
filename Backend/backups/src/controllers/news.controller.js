const { getDb, connectToMongoDB } = require('../config/database');

// News Controller
const getAllNews = async (req, res) => {
    try {
        const db = getDb();
        const news = await db.collection('news').find().sort({ date: -1 }).toArray();
        res.status(200).json(news);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching news' });
    }
};

const submitNews = async (req, res, db) => {
    const { heading, date, description, user } = req.body;

    try {
        // Check if database is initialized
        const db = await connectToMongoDB();
        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        // Insert news data into the 'news' collection
        const result = await db.collection('news').insertOne({
            heading,
            description,
            date,
            user,  // The user who submitted the news
            created_at: new Date()  // Timestamp of when the news was created
        });

        // Send back a success response with the inserted news ID
        res.status(201).json({ message: 'News data received and saved successfully', newsId: result.insertedId });
    } catch (error) {
        console.error('Error submitting news:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllNews,
    submitNews,
};
