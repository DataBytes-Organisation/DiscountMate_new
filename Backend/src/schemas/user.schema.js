const { Schema, model, Types } = require('mongoose');
const { getSchemaOptions } = require('./schema-options');
const { UserType } = require('../types/user.type');

const UserSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true, 
  },
  user_fname: {
    type: String,
    required: [true, 'First name is required'],
    minlength: [2, 'First name must be at least 2 characters long'],
    maxlength: [100, 'First name cannot exceed 100 characters'],
  },
  user_lname: {
    type: String,
    required: [true, 'Last name is required'],
    minlength: [2, 'Last name must be at least 2 characters long'],
    maxlength: [100, 'Last name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    unique: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
  },
  address: {
    type: String,
    required: false, // Optional field
    minlength: [5, 'Address must be at least 5 characters long'],
    maxlength: [200, 'Address cannot exceed 200 characters'],
  },
  phone_number: {
    type: String,
    required: false, // Optional field
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number'],
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    required: [true, 'Role is required'],
  },
  profileID: {
    type: String,
    required: false,
  },
  admin: {
    type: Boolean,
    default: false, // Default is false for regular users
  },
}, getSchemaOptions());

UserSchema.virtual('profile', {
  ref: 'profile',
  localField: 'profileID',
  foreignField: '_id',
  justOne: true,
});

const User = model('user', UserSchema, 'users');

module.exports = { User, UserSchema };
