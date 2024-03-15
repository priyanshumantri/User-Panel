const mongoose = require("mongoose")
const brokerSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    mobile: {
        type: String,
    },
    contactPerson: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    PAN: {
        type: String,
    },
    email: {
        type: String,
    },
    address: {
        type: String,
        required: true
    },
    state: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "states"
    },
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "cities"
    },
    vehicles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "vehciles"
    }],
    ledger : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "ledgers"
    }


})



module.exports = brokerSchema
