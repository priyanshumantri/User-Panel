const mongoose = require("mongoose")

const clientRateMasterSchema = mongoose.Schema({
    for : {
    type : String,
    required : true
    },
    client : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "ledgers"
    },
    rateON : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "rate-on"
    },
    effectiveDate : {
        type : String,
        required : true
    },
    from : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "cities"
    }],
    to : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "cities"
    }],
    defaultRate : [{
        charge : {
            type : String,
            required : true
        },
        chargeType : {
            type : String,
            required : true
        },
        basic : {
            type : Number,
            default : 0
        },
        from : {
            type : Number,
            default : 0
        },
        to : {
            type : Number,
            default : 0
        },
        amount : {
            type : Number,
            default : 0
        }
    }]
})

module.exports = clientRateMasterSchema