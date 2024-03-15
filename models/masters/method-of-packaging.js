const mongoose = require("mongoose")

const methodOfPackagingSchema = new mongoose.Schema ({

methodOfPackaging : {
    type : String,
    required : true
}
   
    
})



module.exports = methodOfPackagingSchema
