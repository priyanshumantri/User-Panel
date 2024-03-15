const mongoose = require('mongoose');
const freightMemoSchema = new mongoose.Schema({
   number : {
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
   challan : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "challans"
   },
   accountTo : {
    type : String,
    required : true
   },
   accountToLedger : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "ledgers"
   },
   rateON : {
    type : String,
    required : true,
    enum : ["actualWeight", "chargedWeight", "pkg", "ftl"]
    },
    rate : {
    type : Number,
    required : true
    },
    freight : {
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    hamali : {
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    mamul : {
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    unloading : {
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    tdsP : {
    type : Number,
    required : true
    },
    tds : {
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    netFreight : {
    type : Number,
    required : true
    },
    advance : {
    type : Number,
    required : true
    },
    balance : {
        amount : {
            type : Number,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    payableAt : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "branches"
    },
    cashAdvance : {
        cashAmount : {
            type : Number,
            required : true
        },
        cashLedger : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers"
        },
        cashStatus : {
            type : String,
            required : true,
            enum : ["paid", "due"]
        },
        cashDate : {
            type : String,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    bankAdvance : {
        bankAmount : {
            type : Number,
            required : true
        },
        bankLedger : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers"
        },
        bankStatus : {
            type : String,
            required : true,
            enum : ["paid", "due"]
        },
        bankDate : {
            type : String,
            required : true
        },
        transactionID : {
            type : String,
           default : null
        }
    },
    dieselAdvance : {
        dieselAmount : {
            type : Number,
            required : true
        },
        dieselLedger : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers"
        },
        dieselStatus : {
            type : String,
            required : true,
            enum : ["paid", "due"]
        },
        dieselDate : {
            type : String,
            required : true
        },
        transactionID : {
            type : String,
            default : null
        }
    },
    othersAdd : [{
        ledger : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers"
        },
        amount : {
            type : Number,
        },
        transactionID : {
            type : String,
            default : null
        }
    }],
    othersSub : [{
        ledger : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "ledgers"
        },
        amount : {
            type : Number,
        },
        transactionID : {
            type : String,
            default : null
        }
    }],
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "users"
    },
    createdAt : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "branches"
    },
    timestamp : {
        type : Date,
        default : Date.now
    }
})

module.exports = freightMemoSchema