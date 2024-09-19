const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Fetch JWT secret from environment variables
const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";

// Signup controller logic
exports.signup = async (req, res) => {
  const {
    useremail,
    password,
    user_fname,
    user_lname,
    address,
    phone_number,
    admin,
  } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email: useremail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      account_user_name: useremail,
      email: useremail,
      encrypted_password: hashedPassword,
      user_fname,
      user_lname,
      address,
      phone_number,
      admin: admin || false,
    });

    const savedUser = await user.save();
    res.status(201).json({
      message: "User created successfully",
      userId: savedUser._id,
    });
  } catch (error) {
    console.error("Error signing up user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Signin controller logic
exports.signin = async (req, res) => {
  const { useremail, password } = req.body;

  try {
    const user = await User.findOne({ email: useremail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.encrypted_password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Include userId in the JWT token payload
    const token = jwt.sign(
      { userId: user._id, useremail: user.email, admin: user.admin },
      jwtSecret, // Use the environment variable here
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Signin successful",
      token,
      admin: user.admin,
    });
  } catch (error) {
    console.error("Error during signin:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Profile controller logic
exports.getProfile = async (req, res) => {
  try {
    const token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    jwt.verify(token, jwtSecret, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const user = await User.findOne(
        { email: decoded.useremail },
        { encrypted_password: 0 }
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({
        user_fname: user.user_fname,
        user_lname: user.user_lname,
        email: user.email,
        address: user.address,
        phone_number: user.phone_number,
        admin: user.admin,
      });
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Update user controller logic
exports.updateUser = async (req, res) => {
  const { userId } = req.params;
  const { user_fname, user_lname, address, phone_number, password } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (password) {
      user.encrypted_password = await bcrypt.hash(password, 10);
    }

    user.user_fname = user_fname || user.user_fname;
    user.user_lname = user_lname || user.user_lname;
    user.address = address || user.address;
    user.phone_number = phone_number || user.phone_number;

    const updatedUser = await user.save();
    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Delete user controller logic
exports.deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.deleteOne(); // This deletes the user
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error); // Ensure this logs any errors
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get all users controller logic
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, { encrypted_password: 0 }); // Exclude password field
    if (!users.length) {
      return res.status(404).json({ message: "No users found" });
    }
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
