const mongoose = require("mongoose")
// Define a subdocument schema for individual units
const lorryArrivalSchema = new mongoose.Schema({

    number : {
        type : String,
        required : true
    }, 
    date : {
        type : String,
        required : true
    },
   challanNumber : {
    type : mongoose.Schema.Types.ObjectId,
    ref: "challans"
    },
    vehicle : {
        type : mongoose.Schema.Types.ObjectId,
        ref: "vehicles"
    },
    material : [{
       lrNumber : {
        type : mongoose.Schema.Types.ObjectId,
        ref: "lorry-reciepts"
       }, 
       qty : {
        type : Number,
        required : true
       },
       chargedWeight : {
        type : Number,
        required : true
       },
       actualWeight : {
        type : Number,
        required : true
       },
       transfer : {
        type : Boolean,
        defualt : false
       }
    }],
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "users",
    },
    createdAtBranch : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "branches"
    },
    createdAtGodown : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "godowns"
    },timestamp: {
        type: Date,
        default: Date.now 
    },
    financialYear : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "financial-years"
    }
    

})



module.exports = lorryArrivalSchema
