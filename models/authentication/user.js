const mongoose = require("mongoose")
const userSchema = new mongoose.Schema ({
    firstName : {
        type : String,
        required : true,
    },
    lastName : {
        type : String,
        required : true,
    },
    email : {
        type : String,
        required : true,
        min : 6
    },
    mobileNumber : {
        type : Number,
        min : 10
    },
    avatar : {
        type : String
    },
    role : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "roles"
    },
    verified : {
        type : Boolean,
        default : false
    },
    branch : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "branches"
    },
    godown : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "godowns"
    },
    financialYear : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "financial-years"
    },
    password : {
        type : String,
        required : true,
        min : 7
    },
    resetPassword : [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "resetPassword"
    }],
    twoFactor: {
        googleLogin: {
            type: Boolean,
            default: false,
        },
        sms: {
            type: Boolean,
            default: false,
        },
    },
    loginSessions: [{
        location : String,
       latitude : String,
       longitude : String,
        device : {
            type : String,
            required : true
        },
        browser : {
            type : String,
            required : true
        },
        ipAddress : {
            type  : String,
            required : true
        },proxy : {
            type : Boolean,
            default : false
        },
        timestamp : {
            type : Date,
            default : Date.now()
        },
        isActiveSession: Boolean,
        expiry :  {
            type : Date,
            default: function () {
                return new Date(new Date().getTime() + 6 * 60 * 60 * 1000); 
            }
        },
        sessionToken : {
            type : String,
            required : true
        },
        activityLogs: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "ActivityLog",
        }]
    }],
    lr : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "lorry-reciepts"
    }],
    challans : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "challans"
    }],
    lorryArrivals : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "lorryArrivals"
    }]
    ,
    lock : {
        type : Boolean,
        default : false
    }
    
})



module.exports = userSchema
