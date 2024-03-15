const mongoose = require("mongoose")
const resetSchema = new mongoose.Schema ({
    token : {
        type : String,
        required : true,
    },
    tokenTime : {
        type : String,
        required : true
    },
    tokenUsed : {
        type : Boolean,
        default : false
    },
    user : [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }]
    
})

const resetPassword = mongoose.model("resetPassword", resetSchema)

module.exports = resetPassword
