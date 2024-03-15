const mongoose = require('mongoose');
const newRefSchema = new mongoose.Schema({

    date : {
        type : String,
        required : true
    },
    number : {
        type : String,
        required : true
    },
    ledger : {
        type : String,
        required : true
    },
    amount : {
        type : String,
        required : true
    },
    reference : {
        type : {
            type : String,
        },
        rel : {
            type : String,
        }
    },
    primaryLedger : {
        type : String,
        default : null
    },

})

module.exports = newRefSchema;