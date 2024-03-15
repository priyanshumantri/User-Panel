const mongoose = require('mongoose')

const seriesSchema = new mongoose.Schema({ 
   
    seriesAssigned : [{
       location : {
        type : String,
        required : true
       
       },
        for : {
            type : String,
            required : true
        },
        start : {
            type : Number,
            required : true
        },
        end : {
            type : Number,
            required : true
        },
        balance : {
            type : Number,
            required : true
        },
        godown : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "godowns"
        },
        branch : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "branches"
        },
        
    }],
    lr : [{
        financialYear : {
            type : String,
            required : true
         },
        location : {
            type : String,
            required : true
        },
        godown : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "godowns"
         },
        branch : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "branches"
         },
         track : [{
            type : Number,
            required : true
         }]
    }],
    lrTrack : [{ 
        type : Number,
        required : true
    }],
    challan : [{
        financialYear : {
            type : String,
            required : true
         },
        location : {
            type : String,
            required : true
        },
        godown : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "godowns"
         },
        branch : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "branches"
         },
         track : [{
            type : Number,
            required : true
         }]
    }],
    challanTrack : [{ 
        type : Number,
        required : true
    }]

})


module.exports = seriesSchema