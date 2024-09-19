const mongoose = require("mongoose");

// Define the User schema
const UserSchema = new mongoose.Schema({
  account_user_name: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  encrypted_password: { type: String, required: true },
  user_fname: { type: String },
  user_lname: { type: String },
  address: { type: String },
  phone_number: { type: String },
  admin: { type: Boolean, default: false },
});

module.exports = mongoose.model("User", UserSchema);
