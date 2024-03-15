const mongoose = require("mongoose");
const stateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  ut : {
    type : Boolean,
    default : false
  },
  cities: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "cities",
    },
  ],
  branches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "branches",
    },
  ],
  godowns: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "godowns",
    },
  ],
  GST: {
    type: String,
    required: true,
  },
  country: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "countries",
  },
  zone : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "zones"
  }
});



module.exports = stateSchema
