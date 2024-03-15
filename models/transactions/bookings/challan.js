const mongoose = require("mongoose")
// Define a subdocument schema for individual units
const challanSchema = new mongoose.Schema({

    number : {
        type : String,
        required : true
    }, 
    date : {
        type : String,
        required : true
    },
    for : {
        type : String,
        required : true
    },
    from : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "godowns"
    },
    to : { 
        type : mongoose.Schema.Types.ObjectId,
        ref : "branches"
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
       actualWeight : {
        type : Number,
        required : true
       } ,
       chargedWeight : {
        type : Number,
        required :true
       },
       handlingBranch : {
        type : mongoose.Schema.Types.ObjectId,
        required :  true
       },
       recieved : {
        type : Boolean,
        default : false
       }
    }],
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "users",
    },
    lorryArrival : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "lorry-arrivals"
    },
    active : {
        type : Boolean,
        default : true
    },
    holdPayment : {
        type : Boolean,
        default : false
    },
    shortageReported : [{

        lrNumber : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "lorry-reciepts"
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
            required  :true
        }

    }],
    materialFound : [{

        lrNumber : {
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
        }
    }],
    financialYear : { 
        type : mongoose.Schema.Types.ObjectId,
        ref : "financial-years"
     },
     fm : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "freight-memos",
        default : null
     }

})



module.exports = challanSchema
