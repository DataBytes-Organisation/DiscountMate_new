const mongoose = require("mongoose");

// Define the Post schema
const PostSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Track users who liked the post
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Track users who disliked the post
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }], // References to comments
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);
