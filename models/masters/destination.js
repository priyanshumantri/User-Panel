const mongoose = require("mongoose")
const destinationSchema = new mongoose.Schema ({

destinationName : {
    type : String,
    required : true
},
handlingBranch : {
    type: mongoose.Schema.Types.ObjectId,
    ref: "branches"
},
state : {
    type: mongoose.Schema.Types.ObjectId,
    ref: "states"
},
fromLR : [{
    type : mongoose.Schema.Types.ObjectId,
    ref : "lorry-reciepts"
}],
toLR : [{
    type : mongoose.Schema.Types.ObjectId,
    ref : "lorry-reciepts"
}]
   
    
})

const destinations = mongoose.model("destinations", destinationSchema)

module.exports = destinations