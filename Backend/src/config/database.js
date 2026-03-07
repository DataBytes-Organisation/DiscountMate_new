const { MongoClient } = require("mongodb");

// Only load .env locally (optional but recommended)
/* if (process.env.NODE_ENV !== "production") {
   require("dotenv").config();
} */

let db;
let client;

async function connectToMongoDB() {
   try {
      const uri = process.env.MONGO_URI; // read it at runtime
      if (!uri) throw new Error("MONGO_URI is not defined");

      if (!client) {
         client = new MongoClient(uri);
         await client.connect();
         db = client.db(process.env.MONGO_DB_NAME || "DiscountMate_DB");
         console.log(`Connected to MongoDB (${db.databaseName})`);
      }

      return db;
   } catch (err) {
      console.error("Connection error to MongoDB:", err);
      throw new Error("Failed to connect to MongoDB");
   }
}

function getDb() {
   if (!db) throw new Error("Database not initialized. Call connectToMongoDB first.");
   return db;
}

module.exports = { connectToMongoDB, getDb };
