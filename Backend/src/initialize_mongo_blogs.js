const { MongoClient } = require('mongodb');

// MongoDB Atlas connection string
const uri = process.env.MONGO_URI;

// Predefined blog data
const blogData = {
    heading: 'How to Save Money on Groceries',
    description: 'This blog post will guide you through some of the best tips to save on grocery shopping.',
    date: new Date().toISOString(),  // Current date and time
    user: 'testuser@example.com',  // The user who posted the blog
};

// Async function to connect to MongoDB and initialize the blogs collection
async function initializeBlogDatabase() {
    let client;

    try {
        // Connect to MongoDB
        client = await MongoClient.connect(uri, { useUnifiedTopology: true });
        console.log('Connected to MongoDB Atlas');

        // Select or create the database and collection
        const db = client.db('user-data');  // Ensure the database name matches
        const blogsCollection = db.collection('blogs');

        // Insert the blog data into the blogs collection
        const result = await blogsCollection.insertOne({
            heading: blogData.heading,
            description: blogData.description,
            date: blogData.date,
            user: blogData.user,  // The email of the user who created the blog
            created_at: new Date(),  // Add a timestamp for when the blog is created
        });

        console.log(`Blog inserted with ID: ${result.insertedId}`);
    } catch (err) {
        console.error('Error initializing the blogs collection:', err);
    } finally {
        // Ensure the client is closed properly
        if (client) {
            await client.close();
            console.log('MongoDB connection closed');
        }
    }
}

// Call the function to initialize the blogs collection with data
initializeBlogDatabase();
