const { MongoClient } = require('mongodb');

// MongoDB Atlas connection string
const uri = process.env.MONGO_URI;

// Predefined news data
const newsData = {
    heading: 'New Features Announced for DiscountMate',
    description: 'We are excited to announce several new features that will improve your shopping experience and help you save even more.',
    date: new Date().toISOString(),  // Current date and time
    user: 'adminuser@example.com',  // The user who posted the news
};

// Async function to connect to MongoDB and initialize the news collection
async function initializeNewsDatabase() {
    let client;

    try {
        // Connect to MongoDB
        client = await MongoClient.connect(uri, { useUnifiedTopology: true });
        console.log('Connected to MongoDB Atlas');

        // Select or create the database and collection
        const db = client.db('user-data');  // Ensure the database name matches
        const newsCollection = db.collection('news');

        // Insert the news data into the news collection
        const result = await newsCollection.insertOne({
            heading: newsData.heading,
            description: newsData.description,
            date: newsData.date,
            user: newsData.user,  // The email of the user who created the news post
            created_at: new Date(),  // Add a timestamp for when the news post is created
        });

        console.log(`News inserted with ID: ${result.insertedId}`);
    } catch (err) {
        console.error('Error initializing the news collection:', err);
    } finally {
        // Ensure the client is closed properly
        if (client) {
            await client.close();
            console.log('MongoDB connection closed');
        }
    }
}

// Call the function to initialize the news collection with data
initializeNewsDatabase();
