const mongoose = require("mongoose")

const lorryRecieptSchema = new mongoose.Schema({
    financialYear : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "financial-years"
    },
    lrNumber: {
        type: String,
        required: true
    },
    loadType: {
        type: String,
        required: true
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "vehicles"
    },
    date: {
        type: String,
        required: true
    },
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "cities"
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "cities"
    },
    bookingBranch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "branches"
    },
    bookingGodown : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "godowns"
    },
    consignorName: {
        type: String,
        required: true
    },
    consignorGST: {
        type: String,
        required: true
    },
    consignor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ledgers"
    },
    consigneeName: {
        type: String,
        required: true
    },
    consigneeGST: {
        type: String,
        required: true
    },
    consignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ledgers"
    },
    deliverySource: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ledgers"
    },
    bookingSource: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ledgers"
    },
    billedAt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "branches"
    },
    billedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ledgers"
    },
    gstPaidBy: {
        type: String,
        required: true,
        enum: ["TPT", "consignor", "consignee", "transporter"]
    },
    ewayBill : [{
        ewayBillNumber : {
            type : String,
        },
        ewayBillExpiry : {
            type : String,
        },
        invoiceNumber : {
            type : String,
            required : true
        },
        invoiceValue : {
            type : Number,
            required : true,
            default : 0
        }
    }],
    materialHold: {
     atBookingGodown : {
        type: Boolean,
        default: false
     },
     atDeliveryGodown : {
        type: Boolean,
        default: false
     }
    },
    pod : {
        type: Boolean,
        default: false
    },
    risk : {
        type: Boolean,
        default: false
    },
    deliveryBy: {
        type: String,
        required: true
    },
    deliveryAddress: {
        type: String,
        required: true
    },
    materialStatus : {
        atBookingGodown : {
            qty : {
                type : Number
            },
            actualWeight : {
                type : Number
            },
            chargedWeight : {
                type : Number
            }
        },
        dispatched : {
            qty : {
                type : Number,
                default : 0
            },
            actualWeight : {
                type : Number,
                default : 0
            },
            chargedWeight : {
                type : Number,
                default : 0
            }
        },
        deliveryGodown : {
            qty : {
                type : Number,
                default : 0
            },
            actualWeight : {
                type : Number,
                default : 0
            },
            chargedWeight : {
                type : Number,
                default : 0
            }
        },   
       transfer : {
            qty : {
                type : Number,
                default : 0
            },
            actualWeight : {
                type : Number,
                default : 0
            },
            chargedWeight : {
                type : Number,
                default : 0
            }
        },   
        pending : {
            qty : {
                type : Number,
                default : 0
            },
            actualWeight : {
                type : Number,
                default : 0
            },
            chargedWeight : {
                type : Number,
                default : 0
            }
        },
        outForDelivery : {
            qty : {
                type : Number,
                default : 0
            },
            actualWeight : {
                type : Number,
                default : 0
            },
            chargedWeight : {
                type : Number,
                default : 0
            }
        },
        delivered : {
            qty : {
                type : Number,
                default : 0
            },
            actualWeight : {
                type : Number,
                default : 0
            },
            chargedWeight : {
                type : Number,
                default : 0
            }
        }
    },
    material: [{
        qty: {
            type: Number,
            required: true
        },
        packaging: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "method-of-packaging"
        },
        goodsDescription: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "goods-description"
        },
        actualWeight: {
            type: Number,
            required: true
        },
        chargedWeight: {
            type: Number,
            required: true
        },
        rateON: {
            type: mongoose.Schema.Types.Mixed,
            ref: "rate-ons",
          },
        rate: {
            type: Number,
            required: true,
        },
        amount: {
            type: Number,
            required: true
        }
    }],
    total: {
        qty: {
            type: String,
            required: true
        },
        actualWeight: {
            type: String,
            required: true
        },
        chargedWeight: {
            type: String,
            required: true
        },
        amount: {
            type: String,
            required: true
        }
    },
    freightDetails: {
        basicFreight: {
            type: Number,
            default : 0
        },
        collectionCharges: {
            type: Number,
            default : 0
        },
        deliveryCharges: {
            type: Number,
            default : 0
        },
        labourCharges: {
            type: Number,
            default : 0
        },
        rebookingCharges: {
            type: Number,
            default : 0
        },
        loadingDetention: {
            type: Number,
            default : 0
        },
        unloadingDetention: {
            type: Number,
            default : 0
        },
        demmurage: {
            type: Number,
            default : 0
        },
        unloadingCharges: {
            type: Number,
            default : 0
        },
        exWeight: {
            type: Number,
            default : 0
        },
        exHeight: {
            type: Number,
            default : 0
        },
        stCharges: {
            type: Number,
            default : 0
        },
        others: {
            type: Number,
            default : 0
        },
        CGST : {
            type : Number,
            default : 0
        },
        SGST : {
            type : Number,
            default : 0
        },
        IGST : {
            type : Number,
            default : 0
        }
    },
    status : {
        type : Boolean,
        default : true
    },
    billNumber : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "freight-invoices",
        default : null
    },
    challans : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "challans"
    }],
    localCollectionChallan : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "local-collection-challans",
        default : null
    },
    deliveryChallans : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "delivery-challans"
    }],
    crossingChallans : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "crossing-challans"
    }],
    lorryArrivals : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "lorry-arrivals"
    }],
    timestamp : {
        type : Date,
        default : Date.now
    },
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "users"
    }


})




module.exports = lorryRecieptSchema
