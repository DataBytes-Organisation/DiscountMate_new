require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");

const userRoutes = require("../routes/userRoutes");
const contactRoutes = require("../routes/contactRoutes");
const postRoutes = require("../routes/postRoutes");
const commentRoutes = require("../routes/commentRoutes");
const replyRoutes = require("../routes/replyRoutes");

const app = express();

const uri = process.env.MONGODB_TEST_URI;

mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to Test MongoDB"))
  .catch((err) => console.error("Connection error to Test DB:", err));

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/replies", replyRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong! Please try again later." });
});

module.exports = app;
