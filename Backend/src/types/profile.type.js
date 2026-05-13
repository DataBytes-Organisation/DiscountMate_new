// profile.type.js

// Define the Profile model
const Profile = {
  _id: String,
  firstName: String,
  lastName: String,
  dob: Date,
  image: String,
  bio: String,
  avatarUrl: String,
};

module.exports = { Profile };
