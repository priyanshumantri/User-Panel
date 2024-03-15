const mongoose = require("mongoose")
const clientUserSchema = new mongoose.Schema ({
    firstName : {
        type : String,
        required : true,
    },
    lastName : {
        type : String,
        required : true,
    },
    email : {
        type : String,
        required : true,
        min : 6
    },
    password : {
        type : String,
        required : true,
        min : 7
    },
    organization : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "clients"
    }
    
})


module.exports = clientUserSchema
