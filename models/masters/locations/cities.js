const mongoose = require("mongoose")
const citySchema = new mongoose.Schema ({

cityName : {
    type : String,
    required : true
},
branches : [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "branches"
}],
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
}],
pinCode : {
    type : String,
    required : true
}
   
    
})


module.exports = citySchema
