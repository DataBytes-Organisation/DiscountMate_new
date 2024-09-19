const Post = require("../models/Post");
const Comment = require("../models/Comment");

// Create a new post

exports.createPost = async (req, res) => {
  try {
    // Create the new post
    const newPost = new Post({
      user: req.user.userId, // Use req.user.userId here
      title: req.body.title,
      description: req.body.description,
    });

    const savedPost = await newPost.save();

    res.status(201).json(savedPost);
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get all posts
exports.getPosts = async (req, res) => {
  try {
    // Extract the sort parameter from the query string
    const { sort } = req.query;

    let sortOption = {};

    // Determine the sorting option based on the query parameter
    switch (sort) {
      case "most_likes":
        sortOption = { likes: -1 }; // Sort by likes in descending order
        break;
      case "most_comments":
        sortOption = { comments: -1 }; // Sort by the number of comments in descending order
        break;
      case "oldest":
        sortOption = { createdAt: 1 }; // Sort by date (oldest first)
        break;
      default:
        sortOption = { createdAt: -1 }; // Sort by date (newest first) by default
        break;
    }

    const posts = await Post.find()
      .populate("user", "user_fname user_lname") // Populate post user
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select: "user_fname user_lname", // Populate user in comments
        },
      })
      .sort(sortOption);

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Like a post
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Check if the user has already liked the post (optional, if you have a way to track per-user likes)
    if (post.likedBy && post.likedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You have already liked this post" });
    }

    post.likes += 1;
    post.likedBy = post.likedBy || []; // Initialize the array if it doesn't exist
    post.likedBy.push(req.user.userId); // Track users who liked the post

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Unlike a post
exports.unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Check if the user has liked the post before unliking
    if (!post.likedBy || !post.likedBy.includes(req.user.userId)) {
      return res.status(400).json({ message: "You haven't liked this post" });
    }

    post.likes -= 1;
    post.likedBy = post.likedBy.filter((userId) => userId !== req.user.userId); // Remove the user from likedBy list

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Dislike a post
exports.dislikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Check if the user has already disliked the post
    if (post.dislikedBy && post.dislikedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You have already disliked this post" });
    }

    post.dislikes += 1;
    post.dislikedBy = post.dislikedBy || []; // Initialize the array if it doesn't exist
    post.dislikedBy.push(req.user.userId); // Track users who disliked the post

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Undislike a post
exports.undislikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Check if the user has disliked the post before undisliking
    if (!post.dislikedBy || !post.dislikedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You haven't disliked this post" });
    }

    post.dislikes -= 1;
    post.dislikedBy = post.dislikedBy.filter(
      (userId) => userId !== req.user.userId
    ); // Remove the user from dislikedBy list

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the user is the owner of the post or an admin
    if (post.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    // Update post fields
    post.title = req.body.title || post.title;
    post.description = req.body.description || post.description;

    const updatedPost = await post.save(); // Save updated post

    res.status(200).json(updatedPost);
  } catch (err) {
    console.error("Error updating post:", err);
    res.status(500).json({ error: err.message });
  }
};

// Delete a post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Check if the user is the owner of the post or an admin
    if (post.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    // Delete the post
    await Post.findByIdAndDelete(req.params.postId);

    // Optionally: Delete related comments
    await Comment.deleteMany({ postId: req.params.postId });

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
