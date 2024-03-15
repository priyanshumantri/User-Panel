const mongoose = require("mongoose")

const branchSchema = new mongoose.Schema ({
   name : {
    type : String,
    required : true
   },
   state : {
      type: mongoose.Schema.Types.ObjectId,
      ref: "states"
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
   branchEmail : {
      type : String,
      required : true
   },

   lr : [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "lorry-reciepts"
   }],
   billingLR : [{
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
         default : false
      }
   }],
   godowns : [{
      type : mongoose.Schema.Types.ObjectId,
      ref : "godowns"
   }],
   sundryDebtors : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "groups"
   },
   sundryCreditors : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "groups"
   },
   cashInHand : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   bookingTBB : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   bookingToPay : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   bookingPaid : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   SGST : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   CGST : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   IGST : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   tdsOnLorryHire : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   lorryHireExpenses : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   haltingExpenses : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   heightExpenses : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   businessPromotionExpenses : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   labourExpenses : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   crossingExpenses : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   collecttionExpenses : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   doorDeliveryExpenses : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   conveyanceExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   electricityExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   godownRent: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   officeExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   petrolExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   poojaExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   postageCourierExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   printingStationeryExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   rebateExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   repairMaintenanceGodown: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   repairMaintenanceElectric: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   repairMaintenanceVehicle:{
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   salaryExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   staffWelfareExpenses: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   telephoneExpenses:{
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   travellingExpenses:{
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   mamulTapalAdvance: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   mamulTapalBalance: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   unloadingLorry: {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   balanceLorryHire : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   advanceLorryHire : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   },
   crossingCommission : {
      type : mongoose.Schema.Types.ObjectId,
      ref : "ledgers"
   }
})



module.exports = branchSchema
