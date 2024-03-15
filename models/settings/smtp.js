const mongoose = require("mongoose")
const smtpSchema = new mongoose.Schema ({

    host :{
        required : true,
        type : String,
        required : true
    },
    port : {
        type : Number,
        required : true
    },
    secure : {
        type : String,
        required : true
    },
    email : {
        type : String,
        required : true
    },
    password : {
        type : String,
        required : true
    }
})

const smtp = mongoose.model("smtp", smtpSchema)

module.exports = smtp
