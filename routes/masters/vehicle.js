const express = require("express")
const Route = express.Router()
const ownersSchema = require("../../models/masters/vehicles/owners")
const driversSchema = require("../../models/masters/vehicles/drivers")
const vehiclesSchema = require("../../models/masters/vehicles/vehicles")
const brokerSchema = require("../../models/masters/vehicles/brokers")
const citySchema = require("../../models/masters/locations/cities")
const stateSchema = require("../../models/masters/locations/states")
const ledgerSchema = require("../../models/masters/ledgers")
const groupSchema = require("../../models/masters/groups")

const freightMemoSchema = require("../../models/transactions/accounts/freight-memo")
const crossingChallanSchema = require("../../models/transactions/delivery/crossing-challan")
const challanSchema = require("../../models/transactions/bookings/challan")
const deliveryChallanSchema = require("../../models/transactions/delivery/delivery-challan")
const localCollectionSchema = require("../../models/transactions/bookings/local-collection-challan")
const axios = require('axios');

const { verifyEmail, updateEmail, updateEmailUsedFalse } = require("../../custom_modules/validations/email")
const { validateMobile, updateMobile, updateMobileUsedFalse } = require("../../custom_modules/validations/mobile")
const validatePANNumber = require("../../custom_modules/validations/pan")
const { validateGSTNumber, updateGSTNumber, updateGSTNumberUsedFalse } = require("../../custom_modules/validations/gst")

Route.get("/masters/vehicles", async (req, res) => {
  const db = req.dbConnection
  const drivers = db.model("drivers", driversSchema)
  const owners = db.model("owners", ownersSchema)
  const vehicles = db.model("vehicles", vehiclesSchema)
  const broker = db.model("brokers", brokerSchema)
  const ownerData = await owners.find({})
  const driverData = await drivers.find({ vehicle: null })
  const driverData2 = await drivers.find({})
  const vehicleData = await vehicles.find({}).populate("owner").populate("driver")
  const brokerData = await broker.find({})

  return res.render("masters/vehicles/vehicles", { driverData2, ownerData: ownerData, driverData: driverData, data: vehicleData, brokerData: brokerData })

})


Route.get("/masters/vehicles/owners", async (req, res) => {
  const db = req.dbConnection
  const owners = db.model("owners", ownersSchema)
  const city = db.model("cities", citySchema)
  const state = db.model("states", stateSchema)
  const cityData = await city.find({})
  const stateData = await state.find({})
  owners.find({}).then(data => {
    res.render("masters/vehicles/owners", { data: data, cityData: cityData, stateData: stateData })
  })
})

Route.get("/masters/vehicles/drivers", (req, res) => {
  const db = req.dbConnection
  const drivers = db.model("drivers", driversSchema)

  drivers.find({}).then((data) => {
    res.render("masters/vehicles/drivers", { data: data })
  })
})

Route.post("/masters/vehicles/owners/new", async (req, res) => {
  const db = req.dbConnection

  const owners = db.model("owners", ownersSchema)
  const ledger = db.model("ledgers", ledgerSchema)
  const group = db.model("groups", groupSchema)
  const mobileNumberPattern = /^\d{10}$/;
  const session = await db.startSession();
  try {
    session.startTransaction();
    const { name, address, state, city, openingBalance, openingBalanceType, mobile, email, PAN, gst } = req.body;

    if (!name ||  !address) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Fill All required Fields" });
    } else if (!mobileNumberPattern.test(mobile)) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Enter A Valid 10 Digit Mobile Number" });
    }

    const mobileValidation = await validateMobile(req.company,db, session, mobile, "owners")
    const emailValidation = await verifyEmail(req.company, db, session, email, "owners")
    const gstValidation = await validateGSTNumber(req.company, gst, "owners")
    if(mobileValidation.status === false) {
        await session.abortTransaction()
        return res.status(400).send({message : mobileValidation.message})
    }
    if(emailValidation.status === false) {
        await session.abortTransaction()
        return res.status(400).send({message : emailValidation.message})
    }
    if(gstValidation.status === false) {
      await session.abortTransaction()
        return res.status(400).send({message : gstValidation.message})
    }
    const validPAN = await validatePANNumber(req.company, PAN, "owners")
    if(validPAN.status === false) {
        await session.abortTransaction()
        return res.status(400).send({message : validPAN.message})
    }




    const newOwners = new owners({
      name: name,
      mobile: mobile,
      address: address,
      PAN: PAN,
      email: email,
      gst: gst,
      state: state,
      city: city,
    });

    const newOwner = await newOwners.save({ session })
    const data = await group.findOne({ name: "Lorry Hire (Creditors)" })
    const newLedger = new ledger({
      name: name,
      mobile: mobile,
      contactPerson: name,
      address: address,
      email: email,
      state: state,
      city: city,
      taxation: {
        PAN: PAN,
        GST: gst
      },
      openingBalance: {
        amount: openingBalance,
        type: openingBalanceType
      },
      group: data._id,
      brokerLedger: true
    })

    await newLedger.save({ session })
    newOwner.ledger = newLedger._id
    await newOwner.save({ session })

    if(mobile) {
      await updateMobile(db, session, mobile)
  }
  if(email) {
      await updateEmail(db, session, email)
  }
  if(gst) {
      await updateGSTNumber(db, session, gst)
  }

    await session.commitTransaction();
    return res.sendStatus(200);
  } catch (error) {
    console.log(error);
    session.abortTransaction();
    return res.sendStatus(500);
  } finally {
    session.endSession();
  }
});


Route.post("/masters/vehicles/owners/edit", async (req, res) => {
  const db = req.dbConnection

  const owners = db.model("owners", ownersSchema)
  const session = await db.startSession();
  try {
    session.startTransaction();
    const {id,  name, address, state, city, gst, PAN, mobile, email} = req.body
    if (!name || !address || !state || !city) {
      res.status(400).send({ message: "Please Fill All required Fields" })
    } else {
        const ownerToUpdate = await owners.findById(id).session(session)
        //remove the old mobile number from usedMobiles array
        if(ownerToUpdate.mobile) {
            await updateMobileUsedFalse(db, session, ownerToUpdate.mobile)
        }
        //remove the old email from usedEmails array
        if(ownerToUpdate.email) {
            await updateEmailUsedFalse(db, session, ownerToUpdate.email)
        }
        //remove the old gst from usedGST array
        if(ownerToUpdate.gst) {
            await updateGSTNumberUsedFalse(db, session, ownerToUpdate.gst)
        }

        const mobileValidation = await validateMobile(req.company, db, session, mobile, "owners", id)
        const emailValidation = await verifyEmail(req.company, db, session, email, "owners", id)
        const gstValidation = await validateGSTNumber(req.company, gst, "owners", id)
        const validPAN = await validatePANNumber(req.company, PAN, "owners", id)
        if(mobileValidation.status === false) {
          await session.abortTransaction()
          return res.status(400).send({message : mobileValidation.message})
      }
      if(emailValidation.status === false) {
          await session.abortTransaction()
          return res.status(400).send({message : emailValidation.message})
      }
      if(gstValidation.status === false) {
        await session.abortTransaction()
          return res.status(400).send({message : gstValidation.message})
      }
      if(validPAN.status === false) {
          await session.abortTransaction()
          return res.status(400).send({message : validPAN.message})
      }

        ownerToUpdate.name = name
        ownerToUpdate.address = address
        ownerToUpdate.state = state
        ownerToUpdate.city = city
        ownerToUpdate.gst = gst
        ownerToUpdate.PAN = PAN
        ownerToUpdate.mobile = mobile
        ownerToUpdate.email = email
        await ownerToUpdate.save({ session })

        if(mobile) {
            await updateMobile(db, session, mobile)
        }
        if(email) {
            await updateEmail(db, session, email)
        }
        if(gst) {
            await updateGSTNumber(db, session, gst)
        }

        await session.commitTransaction()
        return res.sendStatus(200)

      
    }

  } catch (error) {
    console.error(error)
    res.sendStatus(500)
  }
})

Route.post("/masters/vehicles/owners/delete", async(req, res) => {
  const db = req.dbConnection
  const fm = db.model("freight-memos", freightMemoSchema)
  const cc = db.model("crossing-challans", crossingChallanSchema)
  const dc = db.model("delivery-challans", deliveryChallanSchema)
  const lc = db.model("local-collection-challans", localCollectionSchema)
  const owners = db.model("owners", ownersSchema)
  const session = await db.startSession()
  try {
    session.startTransaction()
    const ownerToDelete = await owners.findById(req.body.id).session(session)
    const data = await fm.find({ accountToLedger: ownerToDelete.ledger }).session()
    const data2 = await cc.find({ accountToLedger: ownerToDelete.ledger }).session()
    const data3 = await dc.find({ accountToLedger: ownerToDelete.ledger }).session()
    const data4 = await lc.find({ accountToLedger: ownerToDelete.ledger }).session()
    if(data.length > 0) {
      await session.abortTransaction()
      return res.status(400).send({message : "Owner is being used in Freight Memo, cannot delete"})
    }
    if(data2.length > 0) {
      await session.abortTransaction()
      return res.status(400).send({message : "Owner is being used in Crossing Challan, cannot delete"})
    }
    if(data3.length > 0) {
      await session.abortTransaction()
      return res.status(400).send({message : "Owner is being used in Delivery Challan, cannot delete"})
    }
    if(data4.length > 0) {
      await session.abortTransaction()
      return res.status(400).send({message : "Owner is being used in Local Collection Challan, cannot delete"})
    }

    //checking for vehicles linked to owner
    if(ownerToDelete.vehicles && ownerToDelete.vehicles.length > 0) {
      await session.abortTransaction()
      return res.status(400).send({message : "Owners is linked to a vehicle, cannot delete"})
    }

    //remove the old mobile number from usedMobiles array
    if(ownerToDelete.mobile) {
        await updateMobileUsedFalse(db, session, ownerToDelete.mobile)
    }
    //remove the old email from usedEmails array
    if(ownerToDelete.email) {
        await updateEmailUsedFalse(db, session, ownerToDelete.email)
    }
    //remove the old gst from usedGST array
    if(ownerToDelete.gst) {
        await updateGSTNumberUsedFalse(db, session, ownerToDelete.gst)
    }

    await owners.findByIdAndDelete(req.body.id).session(session)
    await session.commitTransaction()
    return res.sendStatus(200)

  } catch (error) {
    await session.abortTransaction()
    console.log(error)
    return res.sendStatus(500)
  } finally {
    session.endSession()
  }

 
})

Route.post("/masters/vehicles/drivers/new", async (req, res) => {
  const db = req.dbConnection
  const drivers = db.model("drivers", driversSchema)

  const mobileNumberPattern = /^\d{10}$/;
  const { name, mobile, address, licenseNumber, licenseValidity } = req.body
  if (!name || !mobile || !licenseNumber || !licenseValidity) {
    res.status(400).send({ message: "Please fill All Required Fields" })
  } else if (!mobileNumberPattern.test(mobile)) {
    res.status(400).send({ message: "Please Enter A Valid 10 Digit Mobile Number" })
  } else {
    const existingLicense = await drivers.findOne({ licenseNumber: licenseNumber })
    const existingMobile = await drivers.findOne({ mobile: mobile })
    if (existingLicense) {
      res.status(400).send({ message: "Driver With This License Already Exists" })
    } else if (existingMobile) {
      res.status(400).send({ message: "Driver With This Mobile Already Exists" })
    } else {


      const licenseValidityParts = licenseValidity.split('-')
      const licenseValidityYear = parseInt(licenseValidityParts[2])
      const licenseValidityMonth = parseInt(licenseValidityParts[1]) - 1
      const licenseValidityDay = parseInt(licenseValidityParts[0])
      const licenseValidityDate = new Date(licenseValidityYear, licenseValidityMonth, licenseValidityDay)
      const currentDate = new Date()
      const sevenDaysAhead = new Date(currentDate)
      sevenDaysAhead.setDate(currentDate.getDate() + 7)
      if (licenseValidityDate < sevenDaysAhead) {
        return res.status(400).send({ message: "Please Enter a Valid License Validity Date" })
      }



      const newDriver = new drivers({
        name: name,
        mobile: mobile,
        address: address,
        licenseNumber: licenseNumber,
        licenseValidity: licenseValidity
      })

      await newDriver.save()
      return res.sendStatus(200)
    }
  }
})

Route.post("/masters/vehicles/drivers/delete", (req, res) => {
  const db = req.dbConnection
  const drivers = db.model("drivers", driversSchema)

  try {
    drivers.findById(req.body.id).then((data) => {
      if (data.vehicle) {
        res.status(400).send({ message: "Driver is Linked To A Vehicle So Cant Be Deleted" })
      } else {
        drivers.findByIdAndDelete(req.body.id).then(() => {
          res.sendStatus(200)
        })
      }
    })
  } catch (error) {
    console.error(error)
    res.sendStatus(500)
  }
})


Route.post("/masters/vehicles/drivers/edit", async (req, res) => {
  const db = req.dbConnection
  const drivers = db.model("drivers", driversSchema)

  const mobileNumberPattern = /^\d{10}$/;
  const { name, mobile, address, licenseNumber, licenseValidity } = req.body
  if (!name || !mobile || !licenseNumber || !licenseValidity) {
    res.status(400).send({ message: "Please fill All Required Fields" })
  } else if (!mobileNumberPattern.test(mobile)) {
    res.status(400).send({ message: "Please Enter A Valid 10 Digit Mobile Number" })
  } else {


    const existingLicense = await drivers.findOne({ licenseNumber: licenseNumber })
    const existingMobile = await drivers.findOne({ mobile: mobile })
    if (existingLicense && existingLicense.id !== req.body.id) {
      res.status(400).send({ message: "Driver With This License Already Exists" })
    } else if (existingMobile && existingMobile.id !== req.body.id) {
      res.status(400).send({ message: "Driver With This Mobile Already Exists" })
    } else {

      const licenseValidityParts = licenseValidity.split('-')
      const licenseValidityYear = parseInt(licenseValidityParts[2])
      const licenseValidityMonth = parseInt(licenseValidityParts[1]) - 1
      const licenseValidityDay = parseInt(licenseValidityParts[0])
      const licenseValidityDate = new Date(licenseValidityYear, licenseValidityMonth, licenseValidityDay)
      const currentDate = new Date()
      const sevenDaysAhead = new Date(currentDate)
      sevenDaysAhead.setDate(currentDate.getDate() + 7)
      if (licenseValidityDate < sevenDaysAhead) {
        return res.status(400).send({ message: "Please Enter a Valid License Validity Date" })
      }

      const updateDriver = await drivers.findById(req.body.id)

      updateDriver.name = name
      updateDriver.mobile = mobile
      updateDriver.address = address
      updateDriver.licenseNumber = licenseNumber
      updateDriver.licenseValidity = licenseValidity
      await updateDriver.save()
      return res.sendStatus(200)
    }
  }
})



Route.post("/masters/vehicles/new", async (req, res) => {
  const db = req.dbConnection;
  const drivers = db.model("drivers", driversSchema);
  const owners = db.model("owners", ownersSchema);
  const brokerM = db.model("brokers", brokerSchema)
  const vehicles = db.model("vehicles", vehiclesSchema);
  const session = await db.startSession();

  try {
    session.startTransaction();
    const {
      vehicleNumber,
      vehicleType,
      engineNumber,
      chassisNumber,
      permitValidity,
      insuranceValidity,
      insuranceNumber,
      insuranceProvider,
      driver,
      owner,
      broker,
      permitNumber
    } = req.body;

    // Check if any of the required fields are missing
    if (!vehicleNumber || !vehicleType || !permitValidity || !insuranceValidity || !insuranceProvider) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Fill All Required Fields" })
    }

    // Check if the permit validity and insurance validity have already passed
    const today = new Date();
    const sevenDaysAhead = new Date(today);
    sevenDaysAhead.setDate(today.getDate() + 7);

    const permitParts = permitValidity.split('-');
    const permityear = parseInt(permitParts[2]);
    const permitmonth = parseInt(permitParts[1]) - 1;
    const permitday = parseInt(permitParts[0]);
    const permitDate = new Date(permityear, permitmonth, permitday);


    const insuranceParts = insuranceValidity.split('-');
    const insuranceyear = parseInt(insuranceParts[2]);
    const insurancemonth = parseInt(insuranceParts[1]) - 1;
    const insuranceday = parseInt(insuranceParts[0]);
    const insuranceDate = new Date(insuranceyear, insurancemonth, insuranceday);


    if (permitDate < sevenDaysAhead) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Enter a Valid Permit Validity Date" })
    } else if (insuranceDate < sevenDaysAhead) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Enter a Valid Insurance Validity Date" })
    }

    // Check if the vehicle number already exists
    const existingVehicle = await vehicles.findOne({ number: vehicleNumber }).session(session);
    if (existingVehicle) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Vehicle Number Already Exists" })
    }

    // Check if the driver is already linked with another vehicle
    const existingDriver = await vehicles.findOne({ driver: driver }).session(session);
    if (existingDriver) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Driver Already Linked With Another Vehicle Number" })
    }

    // If all validations pass, create a new vehicle and link it to driver and owner
    const newVehicle = new vehicles({
      number: vehicleNumber,
      type: vehicleType,
      engineNumber: engineNumber,
      chassisNumber: chassisNumber,
      permitValidity: permitValidity,
      insuranceValidity: insuranceValidity,
      insuranceNumber: insuranceNumber,
      owner: owner,
      driver: driver,
      permitNumber: permitNumber,
      insuranceProvider: insuranceProvider,
      broker: broker
    });

    await newVehicle.save({ session: session });
    await drivers.findByIdAndUpdate(driver, { vehicle: newVehicle.id }).session(session);
    await owners.findByIdAndUpdate(owner, { $push: { vehicles: newVehicle.id } }).session(session);
    if (broker != "") {
      await brokerM.findByIdAndUpdate(broker, { $push: { vehicles: newVehicle.id } }).session(session)
    }

    await session.commitTransaction();
    res.sendStatus(200);
  } catch (error) {
    await session.abortTransaction();
    console.log(err)
    res.status(500).send({ message: "Internal Server Error" });
  } finally {
    session.endSession();
  }
});

Route.post("/masters/vehicles/delete", async (req, res) => {
  const db = req.dbConnection;
  const session = await db.startSession();
  const vehicles = db.model("vehicles", vehiclesSchema);
  const drivers = db.model("drivers", driversSchema);
  const owners = db.model("owners", ownersSchema);
  const challanM = db.model("challans", challanSchema);
  const crossingChallanM = db.model("crossing-challans", crossingChallanSchema);
  const deliveryChallanM = db.model("delivery-challans", deliveryChallanSchema);
  const localCollectionChallanM = db.model("local-collection-challans", localCollectionChallanSchema);
  const brokerM = db.model("brokers", brokerSchema)
  
  try {
    session.startTransaction();
    const vehicleID = Array.isArray(req.body.id) ? req.body.id : [req.body.id];

    for (const id of vehicleID) {
      const data = await challanM.find({ vehicle: id }).session(session);
      if (data.length > 0) {
        await session.abortTransaction();
        return res.status(400).send({ message: "Vehicle is being used in Challan, cannot delete" });
      }

      const data2 = await crossingChallanM.find({ vehicle: id }).session(session);
      if (data2.length > 0) {
        await session.abortTransaction();
        return res.status(400).send({ message: "Vehicle is being used in Crossing Challan, cannot delete" });
      }

      const data3 = await deliveryChallanM.find({ vehicle: id }).session(session);
      if (data3.length > 0) {
        await session.abortTransaction();
        return res.status(400).send({ message: "Vehicle is being used in Delivery Challan, cannot delete" });
      }

      const data4 = await localCollectionChallanM.find({ vehicle: id }).session(session);
      if (data4.length > 0) {
        await session.abortTransaction();
        return res.status(400).send({ message: "Vehicle is being used in Local Collection Challan, cannot delete" });
      }


      // Check other conditions for remaining data...

    }

    for (const id of vehicleID) {
      const deletedVehicle = await vehicles.findByIdAndDelete(id).session(session);
      if (deletedVehicle && deletedVehicle.driver) {
        await drivers.findByIdAndUpdate(deletedVehicle.driver, { vehicle: null }).session(session);
      }
      if (deletedVehicle && deletedVehicle.owner) {
        await owners.findByIdAndUpdate(deletedVehicle.owner, { $pull: { vehicles: deletedVehicle.id } }).session(session);
      }
      if (deletedVehicle && deletedVehicle.broker) {
        await brokerM.findByIdAndUpdate(deletedVehicle.broker, { $pull: { vehicles: deletedVehicle.id } }).session(session)
      }
      completedOperations++;

      if (completedOperations === vehicleID.length) {
        await session.abortTransaction();
        console.log("done")
      }


    }

    await session.commitTransaction();
    res.send({ message: "Vehicles deleted successfully" });
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    res.sendStatus(500);
  } finally {
    session.endSession();
  }
});





Route.get("/masters/vehicles/edit", async (req, res) => {
  const db = req.dbConnection;
  const drivers = db.model("drivers", driversSchema);
  const owners = db.model("owners", ownersSchema);
  const vehicles = db.model("vehicles", vehiclesSchema);


  try {
    const vehicleData = await vehicles.findById(req.query.id)

    return res.status(200).send(vehicleData)
  } catch (error) {

    console.log(err)
    return res.status(500).send({ message: "Internal Server Error" });
  }
});

Route.post("/masters/vehicles/edit", async (req, res) => {
  const db = req.dbConnection;
  const drivers = db.model("drivers", driversSchema);
  const owners = db.model("owners", ownersSchema);
  const vehicles = db.model("vehicles", vehiclesSchema);
  const brokerModel = db.model("brokers", brokerSchema)
  const session = await db.startSession();

  try {
    session.startTransaction();
    const {
      vehicleNumber,
      vehicleType,
      engineNumber,
      chassisNumber,
      permitValidity,
      insuranceValidity,
      insuranceNumber,
      insuranceProvider,
      driver,
      owner,
      broker,
      permitNumber,
      oldDriver,
      oldOwner,
      oldBroker
    } = req.body;

    // Check if any of the required fields are missing
    if (!vehicleNumber || !vehicleType || !permitValidity || !insuranceValidity) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Fill All Required Fields" })
    }

    // Check if the permit validity and insurance validity have already passed
    const currentDate = new Date();
    const permitDate = new Date(permitValidity);
    const insuranceDate = new Date(insuranceValidity);

    if (permitDate < currentDate) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Permit Validity Has Already Passed" })
    } else if (insuranceDate < currentDate) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Insurance Validity Has Already Passed" })
    }

    // Check if the vehicle number already exists
    const existingVehicle = await vehicles.findOne({ number: vehicleNumber }).session(session)
    // Check if the driver is already linked with another vehicle
    const existingDriver = await vehicles.findOne({ driver: driver }).session(session)

    if (existingVehicle && existingVehicle.id.toString() !== req.body.id.toString()) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Vehicle Number Already Exists" })
    } else if (existingDriver && existingDriver.id.toString() !== req.body.id.toString()) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Driver Already Linked With Another Vehicle Number" })
    }

    const updateVehicle = await vehicles.findById(req.body.id).session(session)
    updateVehicle.number = vehicleNumber;
    updateVehicle.type = vehicleType;
    updateVehicle.engineNumber = engineNumber;
    updateVehicle.chassisNumber = chassisNumber;
    updateVehicle.permitValidity = permitValidity;
    updateVehicle.insuranceValidity = insuranceValidity;
    updateVehicle.insuranceNumber = insuranceNumber;
    updateVehicle.insuranceProvider = insuranceProvider;
    updateVehicle.owner = owner;
    updateVehicle.driver = driver;
    updateVehicle.permitNumber = permitNumber;
    if (broker) {
      updateVehicle.broker = broker
    }
    await updateVehicle.save();

    // Update old driver
    await drivers.findByIdAndUpdate(oldDriver, { vehicle: null }).session(session);
    // Update new driver
    await drivers.findByIdAndUpdate(driver, { vehicle: req.body.id }).session(session);
    // Update old owner
    await owners.findByIdAndUpdate(oldOwner, { $pull: { vehicles: req.body.id } }).session(session);
    // Update new owner
    await owners.findByIdAndUpdate(owner, { $push: { vehicles: req.body.id } }).session(session);

    // Update old owner
    if (oldBroker != "") {
      await brokerModel.findByIdAndUpdate(oldBroker, { $pull: { vehicles: req.body.id } }).session(session)
    }
    if (broker != "") {
      // Update new owner
      await brokerModel.findByIdAndUpdate(broker, { $push: { vehicles: req.body.id } }).session(session)
    }

    await session.commitTransaction();
    res.sendStatus(200);
  } catch (error) {
    await session.abortTransaction();
    console.log(err)
    res.status(500).send({ message: "Internal Server Error" });
  } finally {
    session.endSession();
  }
});

Route.get("/masters/vehicles/getVehicleDetails", (req, res) => {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("clientId", "dbe20d3c21b77046341464db318d8eea:ebce1f3c6c5ddd7ac312e1bac8bde549");
  myHeaders.append("secretKey", "LTOJ6dE6LXCE1mte41zUTce9ZdW6rWlecNgtGhhBp9twIwu9vc3Ke6BrqFp4dHVDa");
  
  const raw = JSON.stringify({
    "vehicleNumber": req.query.vehicleNumber
  });
  
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow"
  };
  
  fetch("https://api.invincibleocean.com/invincible/vehicleRcFastestV5", requestOptions).then((res)=> {
    return res.json().then((data)=> {
      if(data.status === 200) {
        const vehicleObject = {
          vehicleType: `${data.result.Make} ${data.result.Model}`,
          engineNumber: data.result.Engine_No,
          chassisNumber: data.result.Chasis_No,
          permitNumber: data.result.Permit_No,
          permitValidity: data.result.Permit_To,
          insuranceNumber: data.result.Previous_Insurer_PolicyNo,
          insuranceValidity: data.result.Insurance_Upto,
          insuranceProvider: data.result.Previous_Insurer,
        };
        console.log(vehicleObject) 
        return res.status(200).send(vehicleObject);
        
      }
    })
  })
})




module.exports = Route