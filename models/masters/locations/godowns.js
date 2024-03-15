const mongoose = require("mongoose")

const godownSchema = new mongoose.Schema ({
   name : {
    type : String,
    required : true
   },
   branch : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "branches"
   },
   address : {
    type : String,
    required : true
   },
   managerName : [{
    type : String,
    required : true
   }],
   managerEmail : [{
    type : String,
    required : true
   }],
   landline : {
    type : String,
    required : true
   },
   std : {
    type : String,
    required : true
   },
   serial : {
      type : String,
      required : true
   },
   managerMobile : [{
      type : Number,
      required : true
   }],
   godownEmail : {
      type : String,
      required : true
   },
   serialToUse : {
      type : String,
      required : true
   },


   lr : [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "lorry-reciepts"
   }],
   users: [{
      type : mongoose.Schema.Types.ObjectId,
      ref : "users"
   }],
   challans : [{
      type : mongoose.Schema.Types.ObjectId,
      ref : "challans"
   }],
   lorryArrivals : [{
      type : mongoose.Schema.Types.ObjectId,
      ref : "lorry-arrivals"
   }],
   deliveryChallans : [{
      type : mongoose.Schema.Types.ObjectId,
      ref : "delivery-challans"
   }]
   ,
   crossingChallans : [{
      type : mongoose.Schema.Types.ObjectId,
      ref : "crossing-challans"
   }]
   ,
   createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users"
   },
   timestamp  : {
      type : Date,
      default : new Date()
   }, 
   shortage : [{
         LR : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "lorry-reciepts"
         },
         challan : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "challans"
         },
         active : {
            type : Boolean,
            default : true
         }
   }],
   stock : [{
      lrNumber : {
         type : mongoose.Schema.Types.ObjectId,
         ref : "lorry-reciepts"
      },

      lorryArrival :{ 
         type : mongoose.Schema.Types.ObjectId,
         ref : "lorry-arrivals"
         }
      ,
      qty : {
         type : Number,
         required : true
      },
      actualWeight : {
         type : Number,
         required : true
      },
      chargedWeight : {
         type : Number,
         required : true
      },
      transfer : {
         type : Boolean,
         default : true
      }
   }]
   
    
})



module.exports = godownSchema
