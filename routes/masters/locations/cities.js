const express = require("express")
const Route = express.Router()
const statesSchema = require("../../../models/masters/locations/states")
const citiesSchema = require("../../../models/masters/locations/cities")
const branchSchema = require("../../../models/masters/locations/branch")
const countrySchema = require("../../../models/masters/locations/country")

Route.get("/masters/cities", (req, res) => {
    const db = req.dbConnection
    const states = db.model("states", statesSchema)
    const cities = db.model("cities", citiesSchema)
    const branch = db.model("branches", branchSchema)

    states.find({}, (err, data) => {
        if (err) {
            console.log(err)
        } else {
            cities.find({}).populate("state").then((cityData) => {
                branch.find({}).then((branchData)=> {
                    res.render("masters/locations/cities", { stateData: data, cityData: cityData, branchData : branchData })
                })
            })
        }
    })
})


Route.post("/masters/cities/new", async (req, res) => {
    const db = req.dbConnection
    const states = db.model("states", statesSchema)
    const cities = db.model("cities", citiesSchema)
    const branch = db.model("branches", branchSchema)
    const country = db.model("countries", countrySchema)

    const session = await db.startSession()

    try {

        session.startTransaction()

        const { cityName, state, pinCode } = req.body;
        const upperCaseCityName = cityName.toUpperCase();

        // Check if a city with the same name already exists
        const existingPinCode = await cities.findOne({ pinCode : pinCode }, null, {session});

        if (existingPinCode) {
            await session.abortTransaction()
            return res.status(400).send({ message: "City with that pin code already exists already exists" });
        }

        // Create a new city object
        const newCityData = {
            cityName: upperCaseCityName,
            state: state,
            pinCode : pinCode
        };

      

        const newCity = new cities(newCityData);

        // Save the new city to the database
        await newCity.save({session});

        // Update the state document with the new city's ID
        const stateData = await states.findByIdAndUpdate(state, { $push: { cities: newCity.id } }, {new : true}).session(session)
        const countryData = await country.findByIdAndUpdate(stateData.country, {$push : {cities : newCity.id}}).session(session)

        await session.commitTransaction()
        return res.sendStatus(200);
    } catch (error) {
        await session.abortTransaction()
        console.error(error);
        return res.sendStatus(500);
    } finally {
        session.endSession()
    }
});


Route.post('/masters/cities/edit', async (req, res) => {
    const db = req.dbConnection;
    const states = db.model("states", statesSchema);
    const cities = db.model("cities", citiesSchema);
    const branch = db.model("branches", branchSchema);
    const country = db.model("countries", countrySchema);

    const session = await db.startSession();

    try {
        session.startTransaction();
        const newCityName = req.body.cityName.toUpperCase();
        const newStateID = req.body.state;
        const cityID = req.body.id;

        // Check if the new city name already exists in the database
        const existingCity = await cities.findOne({ cityName: newCityName }).session(session);

        if (existingCity && existingCity._id.toString() !== cityID) {
            await session.abortTransaction();
            return res.status(400).send({ message: 'City With That Name Already Exists' });
        }

        // Find the city by its ID
        const city = await cities.findById(cityID).session(session);

        if (!city) {
            await session.abortTransaction();
            return res.status(404).send({ message: 'No Such City Found' });
        }

        // Check if the city is moving to a new state
        if (city.state.toString() !== newStateID) {
            await states.updateOne({ _id: city.state }, { $pull: { cities: cityID } }).session(session);
            await states.updateOne({ _id: newStateID }, { $push: { cities: cityID } }).session(session);

            city.cityName = newCityName;
            city.state = newStateID;
        } else {
            city.cityName = newCityName;
        }

        // Save the city within the same transaction
        await city.save({ session: session });

        await session.commitTransaction();
        session.endSession();

        return res.sendStatus(200);
    } catch (error) {
        await session.abortTransaction();
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



Route.post("/masters/cities/delete", async (req, res)=> {

    const db = req.dbConnection;
    const states = db.model("states", statesSchema);
    const cities = db.model("cities", citiesSchema);
    const country = db.model("countries", countrySchema);

    const session = await db.startSession();

  try {
    session.startTransaction()
    const cityData = await  cities.findById(req.body.id).session(session)
    if(cityData.branches.length > 0) {
        await session.abortTransaction()
        return res.status(400).send({message : "City with Branches Cant Be Deleted"})
    }

    await cities.findByIdAndDelete(req.body.id).session(session)
    const stateData = await states.findByIdAndUpdate(cityData.state, {$pull : {cities : req.body.id}}).session(session)
    await country.findByIdAndUpdate(stateData.country, {$pull : {cities : req.body.id}}).session(session)
    await session.commitTransaction()
    return res.sendStatus(200)

  } catch(err) {
    await session.abortTransaction()
    console.log(err)
    res.sendStatus(500)
  } finally {
    session.endSession()
  }

})
module.exports = Route