const mongoose = require("mongoose")

const rateONSchema = mongoose.Schema({
    rateON : {
        type : String,
        required : true
    },
    unit : {
        type : String,
        required : true
    },
    lock : {
        type : Boolean,
        default : false
    }
})

module.exports = rateONSchema