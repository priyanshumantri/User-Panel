const mongoose = require("mongoose")
const clientSchema = new mongoose.Schema ({

    
    name : {
        type : String,
        required : true
    },
    email : {
        type : String,
        required : true
    },
    mobile : {
        type : String,
        requirec : true
    },
    address : {
        type : String,
        required : true
    },
    logo : {
        type : String,
        required : true
    },
    databaseName : {
        type : String,
        required : true
    },
    adminEmail : {
        type : String,
        required : true
    },
    adminPassword : {
        type : String,
        required : true
    },
    countriesAccess : [{
      name : {
        type : String,
        required : true
      },
      code : {
        type : String,
        required : true
      }
    }],
    displayBillDifference : {
        type : Boolean
    },
    maxUsers : {
        type : Number,
        required : true
    },
    maxBranches : {
        type : Number,
        required : true
    },
    subdomain : {
        type : String,
        required : true
    }

})


module.exports = clientSchema
