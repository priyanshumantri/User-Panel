const mongoose = require('mongoose');
const freightInvoiceSchema = new mongoose.Schema({
    ledger : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "ledgers"
    },
    branch : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "branches"
    },
    godown : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "godowns"
    },
    billNumber : {
        type : String,
        required : true
    },
    date : {
        type : String,
        required : true
    
    },
    fy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "financial-years"
    },
    lr : [{
        lrNumber : { 
            type : mongoose.Schema.Types.ObjectId,
            ref : "lorry-reciepts"
        },
        freight : {
            type : Number,
            required : true
        },
        collectionCharges : {
            type : Number,
            required : true
        },
        delivery : {
            type : Number,
            required : true
        },
        labour : {
            type : Number,
            required : true
        },
        rebooking : {
            type : Number,
            required : true
        },
        loadingDetention : {
            type : Number,
            required : true
        },
        unloadingDetention : {
            type : Number,
            required : true
        },
        demmurage : {
            type : Number,
            required : true
        },
        unloading : {
            type : Number,
            required : true
        },
        exWeight : {
            type : Number,
            required : true
        },
        exHeight : {
            type : Number,
            required : true
        },
        st : {
            type : Number,
            required : true  
        },
        others : {
            type : Number,
            required : true
        },
        cgst : {
            type : Number,
            required : true
        },
        sgst : {
            type : Number,
            required : true
        },
        igst : {
            type : Number,
            required : true
        }
    }],
    paid : {
        type : Boolean,
        default : false
    },
    createdAt : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "branches"
    },
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "users"
    },
    timestamp : {
        type : Date,
        default : Date.now
    }
    
})

module.exports = freightInvoiceSchema