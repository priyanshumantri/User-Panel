const mongoose = require("mongoose")
const driverSchema = new mongoose.Schema ({

name : {
    type : String,
    required : true
},
mobile : {
    type : String,
    required  :true
},
address : {
    type : String,
},
licenseNumber : {
    type : String,
    required : true
},
vehicle : {
    type: mongoose.Schema.Types.ObjectId,
    ref: "vehicles"
},
licenseValidity : {
    type : String,
    required : true
}


})



module.exports = driverSchema
