const mongoose = require('mongoose');
const emailSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    at: {
        type: String,
        required: true,
        enum: ['ledgers', 'users', 'brokers', 'owners', 'drivers'],
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    used : {
        type: Boolean,
        default: false
    }
});
module.exports = emailSchema;