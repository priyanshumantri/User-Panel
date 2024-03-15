const mongoose = require('mongoose');
const newContraVoucherSchema = new mongoose.Schema({

    voucherNumber : {
    type : String,
    required : true
    },
    fy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "financial-years",
    },
    date : {
        type : String,
        required : true
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
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
            default : null
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
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    }],


})

module.exports = newContraVoucherSchema