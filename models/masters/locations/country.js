const mongoose = require("mongoose");
const countrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  zones: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "zones",
    },
  ],
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
  ]
});



module.exports = countrySchema
