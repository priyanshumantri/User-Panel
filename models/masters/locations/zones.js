const mongoose = require("mongoose");
const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  country : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "countries"
  },
  states: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "states",
  }],
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
  godowns : [{
    type : mongoose.Schema.Types.ObjectId,
    ref : "godowns"
  }]
});



module.exports = zoneSchema
