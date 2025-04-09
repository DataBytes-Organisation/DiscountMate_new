const mongoose = require('mongoose');
const { ProfileType } = require('../types/profile.type');
const { Schema } = require('mongoose');

const ProfileSchema = new Schema<ProfileType>({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true, 
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  dob: {
    type: Date,
    required: true,
  },
  image: String,
  bio: String,
});

const Profile = mongoose.model<ProfileType>('profile', ProfileSchema, 'profiles');

module.exports = { Profile, ProfileSchema };
