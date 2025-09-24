const { Schema } = require('mongoose');

const schemaOptions = {
  autoCreate: true,
  autoIndex: true,
  toJSON: {
    virtuals: true,
    getters: true,
  },
  toObject: {
    virtuals: true,
    getters: true,
  },
  versionKey: false,
  timestamps: true,
  id: false,
  collectionOptions: { changeStreamPreAndPostImages: { enabled: true } },
};

const getSchemaOptions = () => {
  return schemaOptions;
};

module.exports = { getSchemaOptions };
