const mongoose = require("mongoose")
const permissionSchema = new mongoose.Schema({

    permissionName: {
        required: true,
        type: String
    },
    roles: [{

        type: mongoose.Schema.Types.ObjectId,
        ref: "roles"


    }],
    createdAt : {
        type : String,
        required : true
    }, 
    
    core : {
        type : Boolean,
        required : true
    },
    note : {
        type : String
    }


})



module.exports = permissionSchema
