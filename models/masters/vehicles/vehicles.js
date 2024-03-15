const mongoose = require("mongoose")
const vehicleSchema = new mongoose.Schema ({

number : {
    type : String
},
type : {
    type : String
},
engineNumber : {
    type : String
},
chassisNumber : {
    type : String
},
permitNumber : {
    type : String
},
permitValidity : {
    type : String
},
insuranceProvider : {
    type : String
},
insuranceValidity : {
    type : String
},
insuranceNumber : {
    type : String
},
insuranceProvider : {
    type : String,
    required : true
},
driver : {
    type: mongoose.Schema.Types.ObjectId,
    ref: "drivers"
},
owner : {
    type: mongoose.Schema.Types.ObjectId,
    ref: "owners"
},
owned : {
    type : Boolean,
    default : false
},
lr : [{
    type : mongoose.Schema.Types.ObjectId,
    ref : "lorry-reciepts"
}],
challan : [{
    type : mongoose.Schema.Types.ObjectId,
    ref : "challans"
}],
broker : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "brokers"
}


})



module.exports = vehicleSchema
