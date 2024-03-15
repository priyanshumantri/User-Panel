const mongoose = require("mongoose")
const ledgersSchema = new mongoose.Schema ({
    entityType : {
        type : String,
        enum : ["registered", "unregistered", "exempted", "rcr"]
    },
    aliasName : {
        type : String,
        default : null
    },
    name : {
        type : String,
        required : true
    },
    group : { 
        type : mongoose.Schema.Types.ObjectId,
        ref : "groups"
     },
     under : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers",
            default : null
     },
    email : {
        type : String
    },
    address : {
        type : String
    },
    mobile : {
        type : String
    },
    state : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "states"
    },
    city : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "cities"
    },
    contactPerson : {
      type : String  
    },
    openingBalance : {
        amount : {
            type : Number,
            default : 0
        
        },
        type : {
            type : String,
            default : "dr",
            enum : ["dr", "cr"]

        },
        fy : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "financial-years"
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    taxation : {
        PAN : {
            type : String
        },
        GST : {
            type : String
        }
    },
    accountNumber : {
        type : Number
    },
    ifsc : {
        type : String
    },
    bankBranch : {
        type : String
    },
    subLedgers : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "ledgers"
    
    }],
    subLedger : {
        type : Boolean,
        default : false
    },
   transactions : [{
    due : {
        type : String,
        default : null
    },
    primaryLedger : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "ledgers",
        default : null
    },
    date : {
        type : String,
        required : true
    },
    fy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "financial-years"
    },
    type : {
        type : String,
        required : true,
        enum : ["dr", "cr"]
    },
    amount : {
        type : Number,
        required : true
    },
    narration : {
        type : String
    },
    chNumber : {
        type : String,
        default : null
    },
    against : [{
        ledger : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers"
        },
        transactionID : {
          type : String,
        }
    
    }],
    reference : {
        type : {
            type : String,
            required : true,
            enum : ["freightInvoice", "freightMemo", "localCollectionChallan" , "deliveryChallan", "crossingChallan",  "reciept",  "payment", "journal", "contra", "new", "onAccount"]
        },
        rel : {
            // here we will store id of the document where this transaction is created for eg. if this transaction is created for a reciept then we will store id of that reciept 
            type : String,
        },
        at : {
            type : String,
            enum : ["openingBalance", "freightInvoice", "freightMemo", "localCollectionChallan" , "deliveryChallan" , "crossingChallan","reciept",  "payment", "journal", "contra", "new", "onAccount"]
        },
        atRel : {
            type : String,
        },
        forV : {
            type : String,
            enum : ["openingBalance", "balanceLorryHire", "advanceLorryHire", null],
            default : null
        }
    },
    timestamp : {
        type : Date,
        default : Date.now
    }
   }],
   brokerLedger : {
       type : Boolean,
       default : false
   },
   defaultLedger : {
    type : Boolean,
    default : false
   }

})



module.exports = ledgersSchema
