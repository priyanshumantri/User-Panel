const mongoose = require('mongoose');
const newGroupSchema = new mongoose.Schema({ 
    name: { 
        type: String, 
        required: true
     },
    under : {
        type : String,
        required : true
    },
    lock : {
        type : Boolean,
        required : true
    },
    
 })

    module.exports = newGroupSchema