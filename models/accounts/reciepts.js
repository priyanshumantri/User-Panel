const mongoose = require('mongoose');
const newRecieptVoucherSchema = new mongoose.Schema({

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
        chNumber : {
            type : String,
            required : true,
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
        chNumber : {
            type : String,
            required : true,
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
    },
    createdAt : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "branches"
    },
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "users"
    }


})

module.exports = newRecieptVoucherSchema