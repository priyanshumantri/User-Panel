const mongoose = require('mongoose');
const newPaymentVoucherSchema = new mongoose.Schema({

voucherNumber : {
    type : String,
    required : true
    },
    date : {
        type : String,
    required : true
    },
    fy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "financial-years",
    },
    drEntry : [{
        primaryLedger : { 
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers",
            default : null
        },
        ledger : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers",
            required : true
        },
        referenceType : {
            type : String,
            required : true
        },
        referenceNumber : {
            type : String,
            required : true
        },
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
        }
    
    }],
    crEntry : [{
        primaryLedger : { 
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers",
            default : null
        },
        chNumber : {
            type : String,
            default : null
        },
        ledger : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers",
            required : true
        },
        referenceType : {
            type : String,
            required : true
        },
        referenceNumber : {
            type : String,
            required : true
        },
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
        }
    }],
    timestamp : {
        type : Date,
        default : Date.now
    }


})

module.exports = newPaymentVoucherSchema