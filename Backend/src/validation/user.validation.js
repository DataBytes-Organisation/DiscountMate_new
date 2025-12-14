const Joi = require('joi');

const signupSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    verifyPassword: Joi.ref('password'),
    user_fname: Joi.string().max(100).required(),
    user_lname: Joi.string().max(100).allow('', null),
    address: Joi.string().allow('', null),
    phone_number: Joi.string().pattern(/^[0-9()+\-\s]{6,20}$/).allow('', null),
    admin: Joi.boolean().optional()
});

const signinSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

module.exports = {
    signupSchema,
    signinSchema
};
