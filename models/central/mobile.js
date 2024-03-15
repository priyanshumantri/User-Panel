const mongoose = require('mongoose');
const mobileSchema = new mongoose.Schema({
    
    mobile: {
        type: Number,
        required: true,
        unique: true,
        minlength: 10,
        maxlength: 10
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
module.exports = mobileSchema;