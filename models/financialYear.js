const mongoose = require("mongoose")

const financialYearSchema = new mongoose.Schema({
    financialYear : {
        type : String,
        required : true
    },
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
         active : {
             type : Boolean,
             required : true
         }
         
     }],
    lr : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "lorry-reciepts"
    }],
    challan : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "challans"
    }],
    la : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "lorry-arrivals"
    }],
    deliveryChallans : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "delivery-challans"
    }], 
    
    lrCALC: [{
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
    challanCALC : [{
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
     laCALC : [{
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
    dcCALC : [{
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
   lcCALC : [{
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
   crossingCALC : [{
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
   
   billNumberCALC : [{
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
fmCALC : [{
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
recieptCALC : [{
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
contraCALC : [{
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
journalCALC : [{
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
paymentCALC : [{
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


})


module.exports = financialYearSchema