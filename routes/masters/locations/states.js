const express = require("express");
const Route = express.Router();
const stateSchema = require("../../../models/masters/locations/states");
const countriesSchema = require("../../../models/masters/locations/country");
const zonesMSchema = require("../../../models/masters/locations/zones");
const mongoose = require("mongoose")
// Renders page to manage states
Route.get("/masters/states", async (req, res) => {

  const db = req.dbConnection
  const state = db.model("states", stateSchema)
  const countries = db.model("countries", countriesSchema)

  const stateData = await state.find({});
  const countryData = await countries.find({});
  res.render("masters/locations/states", {
    stateData: stateData,
    countryData: countryData,
  });
});

// Creates new state
Route.post("/masters/states/new", async (req, res) => {
  const db = req.dbConnection
  const state = db.model("states", stateSchema)
  const countries = db.model("countries", countriesSchema)
  const zonesM = db.model("zones", zonesMSchema)
  const session = await db.startSession()



  try {
    session.startTransaction()
    const { stateName, country, zones, GST, ut } = req.body;

    if (!stateName || !GST || !country || !zones) {
      await session.abortTransaction()
      return res
        .status(400)
        .json({ message: "Please fill all required fields" });
    }

    const existingState = await state.findOne({
      country: country,
      stateName: stateName.toUpperCase(),
    }, null, { session });
    if (existingState) {
      await session.abortTransaction()
      return res
        .status(400)
        .json({ message: "State with that name already exists" });
    }

    const existingGST = await state.findOne({ GST: GST }, null, { session });
    if (existingGST) {
      await session.abortTransaction()
      return res
        .status(400)
        .json({ message: "GST already linked to another state" });
    }

    let utStatus = false;
    if (ut === "true") {
      utStatus = true;
    }

    const newState = new state({
      name: stateName.toUpperCase(),
      GST: GST,
      zone: zones,
      country: country,
      ut: utStatus,
    });

    const savedState = await newState.save({ session });

    //updating state in zones
    const zoneToUpdate = await zonesM.findById(zones, null, { session });
    zoneToUpdate.states.push(savedState.id);
    await zoneToUpdate.save();

    //updating state in country
    const countryToUpdate = await countries.findById(zoneToUpdate.country, null, { session });
    countryToUpdate.states.push(savedState.id);
    await countryToUpdate.save();
    await session.commitTransaction()
    res.sendStatus(200);
  } catch (error) {
    await session.abortTransaction()
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    session.endSession()
  }



});

// Edit State

Route.post("/masters/states/edit", async (req, res) => {
  const db = req.dbConnection
  const state = db.model("states", stateSchema)
  const zonesM = db.model("zones", zonesMSchema)

  const session = await db.startSession()
  try {
    session.startTransaction()
    const { stateName, GST, id, editZone, ut } = req.body; // Destructure id from req.body

    if (!stateName || !GST) {
      await session.abortTransaction()
      return res
        .status(400)
        .json({ message: "Please fill all required fields" });
    }

    const existingState = await state.findOne({
      name: { $regex: new RegExp(stateName, "i") },
      _id: { $ne: id }, // Exclude the current state by its id
    });

    if (existingState) {
      await session.abortTransaction()
      return res
        .status(400)
        .json({ message: "State with that name already exists" });
    }

    const existingGST = await state.findOne({
      GST: GST, // Exclude the current state by its id
    }).session(session)

    if (existingGST && existingGST.id !== id) {
      await session.abortTransaction()
      return res
        .status(400)
        .json({ message: "GST already linked to another state" });
    }

    // Update the state with the provided id
    const updateState = await state.findById(id).session(session)

    // Find the old zone where the state is currently located
    if(updateState.zone) {
      const oldZone = await zonesM.findById(updateState.zone).session(session)

    // Remove the state ID from the old zone
    oldZone.states.pull(updateState.id);
    await oldZone.save();
    }
    let utStatus = false;
    if (ut === "true") {
      utStatus = true;
    }


    // Update the state's information
    updateState.name = stateName;
    updateState.GST = GST;
    updateState.ut = utStatus;
    if(editZone) {
      updateState.zone = editZone;
    }
    await updateState.save();

    // Find the new zone and push the state ID to it
    // Find the new zone to update
   if(editZone) {
    const newZoneToUpdate = await zonesM.findById(editZone).session(session)

    // Check if the state ID already exists in the new zone
    if (!newZoneToUpdate.states.includes(updateState.id)) {
      // Push the state ID to the new zone
      newZoneToUpdate.states.push(updateState.id);
      await newZoneToUpdate.save();
    }
   }
    await session.commitTransaction()
    res.sendStatus(200);
  } catch (error) {
    await session.abortTransaction()
    console.error(error);
  } finally {
    session.endSession()
  }
});

// Deletes State
Route.post("/masters/states/delete", async (req, res) => {
  const db = req.dbConnection
  const state = db.model("states", stateSchema)
  const zonesM = db.model("zones", zonesMSchema)
  const countries = db.model("countries", countriesSchema)
  const session = await db.startSession()
  try {
    session.startTransaction()
    const states = await state.findById(req.body.id).session(session)
    if (states.length > 1) {
      await session.abortTransaction()
      return res.status(400).send({ message: "States with cities cant be deleted" });
    } else {
      const data = await state.findByIdAndDelete(req.body.id).session(session)
      //updating state zone
      const zoneToUpdate = await zonesM.findById(data.zone).session(session)
      zoneToUpdate.states.pull(data.id);
      await zoneToUpdate.save();

      //updating state in country
      const countryToUpdate = await countries.findById(zoneToUpdate.country).session(session)
      countryToUpdate.states.pull(req.body.id);
      await countryToUpdate.save();
      await session.commitTransaction()
      res.sendStatus(200);

    }
  } catch (error) {
    await session.abortTransaction()
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    session.endSession()
  }
});

module.exports = Route;
