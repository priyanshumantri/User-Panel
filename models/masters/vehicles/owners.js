const mongoose = require("mongoose")
const ownerSchema = new mongoose.Schema ({

name : {
    type : String
},
mobile : {
    type : String
},
address : {
    type : String
},
PAN : {
    type : String
},
vehicles : [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "vehciles"
}],
state : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "states"
},
city : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "cities"
},
gst : {
    type : String,
},
email : {
    type : String
},
ledger : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "ledgers"
}


})



module.exports = ownerSchema
