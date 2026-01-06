const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
let db;
let client;

async function connectToMongoDB() {
    try {
        if (!client || !client.topology || client.topology.isConnected() === false) {
            client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
            await client.connect();
            db = client.db('user-data');
            console.log('Connected to MongoDB Atlas');
        }
        return db;
    } catch (err) {
        console.error('Connection error to MongoDB:', err);
        throw new Error('Failed to connect to MongoDB');
    }
}
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call connectToMongoDB first.');
    }
    return db;
}
module.exports = {
    connectToMongoDB,
    getDb,
};


