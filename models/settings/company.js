const mongoose = require("mongoose")
const companySchema = new mongoose.Schema({

    companyName: {
        required: true,
        type: String
    },
    companyLogo: {
        required: true,
        type: String
    },
    websiteURL: {
        type: String,
    },
    companyAddress: {
        type: String,
        required: true
    },
    companyMobile: {
        type: Number,
        required: true
    },
    companyEmail: {
        type: String,
        required: true
    },
    panCard: {
        type: String,
        required: true
    },
    maxUsers: {
        type: Number,
        required: true
    },
    maxBranches: {
        type: Number,
        required: true
    },
    displayBillDifference: {
        type: Boolean,
        default: true
    },
    active: {
        type: Boolean,
        default: true
    },
    security: {
        sms: {
            type: Boolean,
            default: false
        },
        email: {
            type: Boolean,
            default: true
        },
        google: {
            type: Boolean,
            default: false
        },
        reset: {
            type: Boolean,
            default: true
        }
    },
    transactions: {
        lr: {
            ewayBill: {
                type: Boolean,
                default: true
            },
            resetSeries: {
                type: Boolean,
                default: true
            }
        },
        deliveryChallans: {
            threshold: {
                type: Number,
                default: 3
            },
            action: {
                type: String,
                default: "expire"
            }
        },
        crossingChallans: {
            threshold: {
                type: Number,
                default: 3
            },
            action: {
                type: String,
                default: "expire"
            }
        }
    },
    validations: {
        ledgers: {
            gst: {
                type: Boolean,
                default: true
            },
            pan: {
                type: Boolean,
                default: true
            },
            udhyam: {
                type: Boolean,
                default: false
            },
            email: {
                type: Boolean,
                default: true
            },
            mobile: {
                type: Boolean,
                default: true
            }
        },
        drivers: {
            pan: {
            type : Boolean,
            default: false,
            },
            dl: {
              type : Boolean,
              default: true,
            }
        },
        brokers: {
            pan: {
              type : Boolean,
                default: true,
            },
            email: {
              type : Boolean,
                default: false,
            },
            mobile: {
                type : Boolean,
                  default: true,
            }
        },
        owners: {
            pan: {
               type : Boolean,
               default: true,
            },
            gst: {
               type : Boolean,
               default: false,
            },
            email: {
              type : Boolean,
              default: false,
            },
            mobile: {
              type : Boolean,
              default: true,
            }
        }
    }
})



module.exports = companySchema
