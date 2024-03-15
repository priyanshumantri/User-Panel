const mongoose = require("mongoose")
const whitelistedIP = new mongoose.Schema ({

    ipAddress : {
        type : String,
        required : true
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    addedAt : {
        type : String,
        required : true
    },
    addedByIP : {
        type : String,
        required : true
    }
})

const whitelisting = mongoose.model("whitelisting", whitelistedIP)

module.exports = whitelisting
