
// Custom function to find a document by ID or return null
const mongoose = require("mongoose");
async function findByIdOrNull(model, id) {
    try {
      const objectId = mongoose.Types.ObjectId(id);
      const data = await model.findById(objectId);
      return data;
    } catch (error) {
      console.log("error")
      return null;
    }
  }

  module.exports = findByIdOrNull;