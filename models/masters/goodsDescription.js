const mongoose = require("mongoose")
const goodsDescriptionSchema = new mongoose.Schema ({

goodsDescription : {
    type : String,
    required : true
}
   
    
})



module.exports = goodsDescriptionSchema
