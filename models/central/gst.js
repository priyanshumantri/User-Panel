const mongoose = require('mongoose');
const gstSchema = new mongoose.Schema({
    
    gst: {
        type: String,
        required: true,
        unique: true,
        minlength: 15,
        maxlength: 15
    },
    at: {
        type: String,
        required: true,
        enum: ['ledgers', 'users', 'brokers', 'owners'],
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    used : {
        type: Boolean,
        default: false
    },
    address : {
        type: String,
        required: true
    },
    state : {
        type: String,
        required: true
    },
    name : {
        type: String,
        required: true
    },
    pan : {
        type: String,
        required: true
    }
});
module.exports = gstSchema;