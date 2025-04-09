const { MongoClient } = require('mongodb');

// MongoDB Atlas connection string
const uri = process.env.MONGO_URI;

// Predefined user data
const userData = {
    useremail: 'rvklenora',
    password: 'password',
    verifyPassword: 'password',
    user_fname: 'test1',
    user_lname: 'test1',
    address: 'test1',
    phone_number: '0447778727',
    admin: true  // Adding admin field, set to true or false as needed
};

// Async function to connect to MongoDB and initialize the database
async function initializeDatabase() {
    let client;

    try {
        // Connect to MongoDB
        client = await MongoClient.connect(uri, { useUnifiedTopology: true });
        console.log('Connected to MongoDB Atlas');

        // Select or create the database and collection
        const db = client.db('user-data');  // Ensure the database name matches
        const usersCollection = db.collection('users');

        // Insert the user data into the users collection
        const result = await usersCollection.insertOne({
            email: userData.useremail,
            password: userData.password,  // Ideally, you should hash the password here
            verifyPassword: userData.verifyPassword,  // Consider removing this in production
            firstName: userData.user_fname,
            lastName: userData.user_lname,
            address: userData.address,
            phone_number: userData.phone_number,
            admin: userData.admin,  // Insert the admin field
            created_at: new Date()  // Add a timestamp for when the user is created
        });

        console.log(`User inserted with ID: ${result.insertedId}`);
    } catch (err) {
        console.error('Error initializing the database:', err);
    } finally {
        // Ensure the client is closed properly
        if (client) {
            await client.close();
            console.log('MongoDB connection closed');
        }
    }
}

// Call the function to initialize the database with data
initializeDatabase();
