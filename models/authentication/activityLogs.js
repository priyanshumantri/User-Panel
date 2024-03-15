const mongoose = require("mongoose");

const activityLogsSchema = new mongoose.Schema({
    activity: {
        type: String,
        required: true,
    },
    user : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    sessionToken : {
        type : String,
        required : true
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    status : {
        type : String,
        required : true
    }
    // Add any other fields as needed
});



module.exports = activityLogsSchema