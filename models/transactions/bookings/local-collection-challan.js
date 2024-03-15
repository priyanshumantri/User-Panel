const mongoose = require("mongoose")
// Define a subdocument schema for individual units
const localCollectionChallanSchema = new mongoose.Schema({

    number: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "vehicles"
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "cities"
    },
    material: [{
        lrNumber: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "lorry-reciepts"
        },
        numberOfPackages: {
            type: Number,
            required: true
        },
        chargedWeight: {
            type: Number,
            required: true
        },
        actualWeight: {
            type: Number,
            required: true
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
    },
    createdAt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "godowns"
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    freight: {
        amount: {
            type: Number,
            required: true
        },
        transactionID: {
            type: String,
            default: null
        }
    },
    cashAdvance: {
        cashAmount: {
            type: Number,
            required: true
        },
        cashLedger: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ledgers"
        },
        cashStatus: {
            type: String,
            required: true,
            enum: ["paid", "due"]
        },
        cashDate: {
            type: String,
        },
        transactionID: {
            type: String,
            default: null
        }
    },
    bankAdvance: {
        bankAmount: {
            type: Number,
            required: true
        },
        bankLedger: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ledgers"
        },
        bankStatus: {
            type: String,
            required: true,
            enum: ["paid", "due"]
        },
        bankDate: {
            type: String,
        },
        transactionID: {
            type: String,
            default: null
        }
    },
    dieselAdvance: {
        dieselAmount: {
            type: Number,
            required: true
        },
        dieselLedger: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ledgers"
        },
        dieselStatus: {
            type: String,
            required: true,
            enum: ["paid", "due"]
        },
        dieselDate: {
            type: String,
        },
        transactionID: {
            type: String,
            default: null
        }
    },
    othersAdd: [{
        ledger: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ledgers"
        },
        amount: {
            type: Number,
        },
        transactionID: {
            type: String,
            default: null
        }
    }],
    othersSub: [{
        ledger: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ledgers"
        },
        amount: {
            type: Number,
        },
        transactionID: {
            type: String,
            default: null
        }
    }],
    accountTO: {
        type: String,
        enum: ["owner", "broker"],
    },
    accountToLedger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ledgers"
    },
    advance: {
        type: Number,
        required: true
    },
    balance: {
        amount: {
            type: Number
        },
        transactionID: {
            type: String,
            default: null
        }
    },


})



module.exports = localCollectionChallanSchema
