const mongoose = require("mongoose")
const communicationSchema = new mongoose.Schema ({

    authProcess : {
        type : String,
        required : true
    }
})



module.exports = communicationSchema
