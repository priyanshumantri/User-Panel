const mongoose = require('mongoose');
const subLedgerSchema = new mongoose.Schema({ 
    name: { 
        type: String, 
        required: true
     },
    under : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "ledgers"
    },
    transactions : [{
        amount : {
            type : Number
        },
        type : {
            type : String
        },
        date : {
            type : Date
        }
    }]
    
 })

    module.exports = subLedgerSchema