require("dotenv").config(); // Load environment variables from .env file
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");

const userRoutes = require("./routes/userRoutes");
const contactRoutes = require("./routes/contactRoutes");
const postRoutes = require("./routes/postRoutes");
const commentRoutes = require("./routes/commentRoutes");
const replyRoutes = require("./routes/replyRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection string from .env file
const uri = process.env.MONGODB_URI;

let db;
let client;

// Connect to MongoDB using Mongoose
mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((mongoClient) => {
    console.log("Connected to MongoDB");
    client = mongoClient.connection.getClient();
    db = client.db(); // Initialize the default database
  })
  .catch((err) => console.error("Connection error:", err));

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Use routes
app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/replies", replyRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong! Please try again later." });
});

// Root route to avoid 404 error
app.get("/", (req, res) => {
  res.send("Welcome to the DiscountMate API!");
});

// Endpoint to get products from 'SampleData.Sample_Product_Master'
app.get("/products", async (req, res) => {
  try {
    if (!client) {
      return res
        .status(500)
        .json({ message: "Database client not initialized" });
    }

    const sampleDataDb = client.db("SampleData");
    const products = await sampleDataDb
      .collection("Sample_Product_Master")
      .find()
      .toArray();

    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: error.message });
  }
});

// Blog Submission API
app.post("/submit-blog", async (req, res) => {
  const { heading, date, description, user } = req.body;

  try {
    if (!db) {
      return res.status(500).json({ message: "Database not initialized" });
    }

    const result = await db.collection("blogs").insertOne({
      heading,
      description,
      date,
      user,
      created_at: new Date(),
    });

    res.status(201).json({
      message: "Blog data received and saved successfully",
      blogId: result.insertedId,
    });
  } catch (error) {
    console.error("Error submitting blog:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// News Submission API
app.post("/submit-news", async (req, res) => {
  const { heading, date, description, user } = req.body;

  try {
    if (!db) {
      return res.status(500).json({ message: "Database not initialized" });
    }

    const result = await db.collection("news").insertOne({
      heading,
      description,
      date,
      user,
      created_at: new Date(),
    });

    res.status(201).json({
      message: "News data received and saved successfully",
      newsId: result.insertedId,
    });
  } catch (error) {
    console.error("Error submitting news:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get All Blogs - ordered by newest first
app.get("/blogs", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: "Database not initialized" });
    }

    const blogs = await db
      .collection("blogs")
      .find()
      .sort({ date: -1 })
      .toArray();
    res.status(200).json(blogs);
  } catch (error) {
    console.error("Error retrieving blogs:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get All News - ordered by newest first
app.get("/news", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: "Database not initialized" });
    }

    const news = await db
      .collection("news")
      .find()
      .sort({ date: -1 })
      .toArray();
    res.status(200).json(news);
  } catch (error) {
    console.error("Error retrieving news:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Gets the User from Token Basket
const getUserFromToken = async (token) => {
  let user;
  await jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.log("Error in token verification=", err);
      return null;
    }

    const useremail = decoded.useremail;
    user = await db
      .collection("USER")
      .findOne({ email: useremail }, { projection: { encrypted_password: 0 } });
  });
  return user;
};

// Get Product Basket
app.post("/getproduct", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: "Database not initialized" });
    }

    const product = await db
      .collection("PRODUCT")
      .findOne({ product_id: req.body.productId });
    res.json({
      product_id: product.product_id,
      product_name: product.product_name,
      link_image: product.link_image,
      current_price: product.current_price,
    });
  } catch (error) {
    console.log("Error", error);
    res.status(500).json({ message: error.message });
  }
});

// Get Basket
app.post("/getbasket", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: "Database not initialized" });
    }

    const baskets = await db.collection("BASKET").find().toArray();
    const getProductUrl = "http://localhost:5000/getproduct";

    if (!baskets) {
      return res.status(404).json({ message: "Basket not found" });
    }

    const token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];
    const user = await getUserFromToken(token);
    const basket = await db
      .collection("BASKET")
      .find({ user_id: user._id.toString() })
      .toArray();

    let response = [];
    for (let i = 0; i < basket.length; i++) {
      const currentProductId = basket[i].product_id;
      const getProductData = { productId: currentProductId };

      await fetch(getProductUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(getProductData),
      })
        .then((res1) => res1.json())
        .then((data) => {
          response.push({
            productId: data.product_id,
            name: data.product_name,
            price: data.current_price,
            image: data.link_image,
            quantity: basket[i].quantity,
          });
        })
        .catch((err) => console.error(err.message));
    }

    res.json(response);
  } catch (error) {
    console.log("Error fetching basket items=>" + error);
    res.status(500).json({ message: error.message });
  }
});

// Update the Quantity in Basket
app.post("/updatequantity", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: "Database not initialized" });
    }

    const token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];
    const user = await getUserFromToken(token);

    const query = {
      user_id: user._id.toString(),
      product_id: req.body.productId,
    };
    const updateResult = await db
      .collection("BASKET")
      .updateOne(query, { $set: { quantity: req.body.quantity } });

    if (updateResult.modifiedCount === 0) {
      console.log(
        "No documents were updated. The document may not exist or the quantity was the same as before."
      );
    } else {
      console.log("Document updated successfully.");
    }

    const getBasketUrl = "http://localhost:5000/getbasket";
    await fetch(getBasketUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res1) => res1.json())
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.error(err.message));
  } catch (error) {
    console.log("Encountered ", error);
    res.status(500).json({ message: error.message });
  }
});

// Delete From Basket
app.delete("/deleteitemfrombasket", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: "Database not initialized" });
    }

    const token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];
    const user = await getUserFromToken(token);

    const query = {
      user_id: user._id.toString(),
      product_id: req.body.productId,
    };
    const deleteResult = await db.collection("BASKET").deleteOne(query);
    console.log(`Deleted ${deleteResult.deletedCount} document(s)`);

    const getBasketUrl = "http://localhost:5000/getbasket";
    await fetch(getBasketUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res1) => res1.json())
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.error(err.message));
  } catch (error) {
    console.log("Error deleting item from basket:", error);
    res.status(500).json({ message: error.message });
  }
});

// Placeholder for future APIs
app.get("/future-api", (req, res) => {
  res.send("This is a placeholder for future APIs");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
