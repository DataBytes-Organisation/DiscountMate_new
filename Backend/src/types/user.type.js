// Define the User model type
const User = {
  _id: String,
  user_fname: String,
  user_lname: String,
  email: String,
  password: String,
  profileID: String,
  address: {
    type: String,
    required: false,
  },
  phone_number: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
  },
  admin: {
    type: Boolean,
    default: false, 
  },
};

// Adding the virtual profile reference for the User model
Object.defineProperty(User, 'profile', {
  value: { type: Object, required: false },
  writable: false,
  enumerable: true,
});

module.exports = { User };
