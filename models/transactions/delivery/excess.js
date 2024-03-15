const mongoose = require("mongoose")
const excessSchema = new mongoose.Schema({ 
    reportedAt : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "godowns"
    },
    reportedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "godowns"
    },
    lorryArrival : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "lorry-arrivals"
    },
    challan : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "challans"
    },
    lr: { 
        type : mongoose.Schema.Types.ObjectId,
        ref : "lorry-reciepts"
     },
    qty : {
        type : Number,
        required : true
    },
    actualWeight : {
        type : Number,
        required : true
    },
    chargedWeight : {
        type : Number,
        required : true
    },
    action : {
        type : String,
        default : "pending"
    },
    timestamp  : {
        type : Date,
        default : new Date()
    },
    
 })

module.exports = excessSchema