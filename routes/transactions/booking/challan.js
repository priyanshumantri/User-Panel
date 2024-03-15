const express = require("express");
const Route = express.Router();
const getCurrentFinancialYear = require("../../../custom_modules/financial-year");

const customFY = require("../../../custom_modules/customFY")


const vehicleDataSchema = require("../../../models/masters/vehicles/vehicles");
const citiesSchema = require("../../../models/masters/locations/cities");
const lrSchema = require("../../../models/transactions/bookings/lorry-reciept");
const branchSchema = require("../../../models/masters/locations/branch");
const challanSchema = require("../../../models/transactions/bookings/challan");
const laSchema = require("../../../models/transactions/delivery/lorry-arrival");
const userSchema = require("../../../models/authentication/user")
const godownSchema = require("../../../models/masters/locations/godowns")
const ownerSchema = require("../../../models/masters/vehicles/owners")
const driverSchema = require("../../../models/masters/vehicles/drivers")
const fySchema = require("../../../models/financialYear")
const brokerSchema = require("../../../models/masters/vehicles/brokers")
const {getPrintNumber, updatePrintNumber} = require("../../../custom_modules/serialCalculator")
Route.get("/transactions/booking/challan", async (req, res) => {
  const db = req.dbConnection
  const cities = db.model("cities", citiesSchema)
  const branch = db.model("branches", branchSchema)
  const vehicles = db.model("vehicles", vehicleDataSchema)
  const challans = db.model("challans", challanSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const owners = db.model("owners", ownerSchema)
  const drivers = db.model("drivers", driverSchema)
  const fy = db.model("financial-years", fySchema)

  const today = new Date();
  const sevenDaysAhead = new Date(today);
  sevenDaysAhead.setDate(today.getDate() + 7);
  const vehicleData = await vehicles.find({}).populate("owner").populate("driver");

  const filteredVehicleData = vehicleData.filter(vehicle => {
    const insuranceParts = vehicle.insuranceValidity.split('-');
    const insuranceyear = parseInt(insuranceParts[2]);
    const insurancemonth = parseInt(insuranceParts[1]) - 1;
    const insuranceday = parseInt(insuranceParts[0]);
    const insuranceDate = new Date(insuranceyear, insurancemonth, insuranceday);

    const permitParts = vehicle.permitValidity.split('-');
    const permityear = parseInt(permitParts[2]);
    const permitmonth = parseInt(permitParts[1]) - 1;
    const permitday = parseInt(permitParts[0]);
    const permitDate = new Date(permityear, permitmonth, permitday);

    const licenseParts = vehicle.driver.licenseValidity.split('-');
    const licenseyear = parseInt(licenseParts[2]);
    const licensemonth = parseInt(licenseParts[1]) - 1;
    const licenseday = parseInt(licenseParts[0]);
    const licenseDate = new Date(licenseyear, licensemonth, licenseday);


    return insuranceDate >= sevenDaysAhead && permitDate >= sevenDaysAhead && licenseDate >= sevenDaysAhead
  });




  const cityData = await cities.find({})
  const branchData = await branch.find({})
  const challanDATA = await challans.find({ from: req.user.godown.id, financialYear: req.user.financialYear }).populate("from").populate("to").populate({ path: "vehicle", populate: { path: "owner" } }).populate({ path: "vehicle", populate: { path: "driver" } }).sort({_id : -1})

  const lrToSend = []
  const lrData = await lr.find({ bookingGodown: req.user.godown.id, "materialHold.atBookingGodown": false })
  const filteredLRData = await lrData.filter((element) => element.materialStatus.atBookingGodown.qty > 0)
  for (const lrID of filteredLRData) {
    lrToSend.push(lrID.id)
  }

  // now we will filter lr which are lying at user branch for transfer purpose
  const filteredBranchStock = req.user.godown.stock.filter((element) => element.transfer === true && element.qty > 0)
  for (const lrID of filteredBranchStock) {
    lrToSend.push(lrID.lrNumber)
  }

  const lrToSendData = await lr.find({ _id: { $in: lrToSend } })


  //getting current challanNumber
  const fyData = await fy.findOne({ _id: req.user.financialYear })
  const challanNumber = await getPrintNumber(db, req.user, "challanCALC")



  res.render("transactions/booking/challan", {challanNumber, vehicleData: filteredVehicleData, cityData: cityData, branchData: branchData, challanDATA: challanDATA, lrDATA: lrToSendData });
});








Route.get("/transactions/booking/challan/get-package-details", async (req, res) => {
  const db = req.dbConnection
  const lr = db.model("lorry-reciepts", lrSchema)
  const lrID = req.query.lrID;
  const lrDATA = await lr.findById(lrID)

  //when user enquires for availabnle package of Normal LR
  if (lrDATA.bookingGodown.toString() === req.user.godown.id.toString()) {

    return res.status(200).send({
      NOP: lrDATA.materialStatus.atBookingGodown.qty,
      actualWeight: lrDATA.materialStatus.atBookingGodown.actualWeight,
      chargedWeight: lrDATA.materialStatus.atBookingGodown.chargedWeight,
    });
  } else {


    const godownData = req.user.godown.stock.find((element) => element.lrNumber.toString() === lrID.toString() && element.transfer === true)

    var totalQTY = godownData.qty
    var totalActuals = godownData.actualWeight
    var totalCharged = godownData.chargedWeight

    return res.status(200).send({
      NOP: totalQTY,
      actualWeight: totalActuals,
      chargedWeight: totalCharged,
    });


  }



});

Route.post("/transactions/booking/challan/new", async (req, res) => {
  const db = req.dbConnection
  const lr = db.model("lorry-reciepts", lrSchema)
  const branch = db.model("branches", branchSchema)
  const challan = db.model("challans", challanSchema)
  const user = db.model("users", userSchema)
  const cities = db.model("cities", citiesSchema)
  const godown = db.model("godowns", godownSchema)
  const fy = db.model("financial-years", fySchema)
  const {
    challanNumberNew,
    challanNumber,
    challanDate,
    challanFor,
    from,
    to,
    vehicle,
    handlingBranch,
    lrNumber,
    NOP,
    actualWeight,
    chargedWeight,
  } = req.body;
  const session = await db.startSession()
  try {
    session.startTransaction()


    if (!challanDate) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Select a Valid Date" });
    }

    if (!challanFor) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Select Challan For" });
    }

    if (!vehicle) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Select a Valid Vehicle Number" });
    }

    if (!lrNumber || !NOP || !actualWeight || !chargedWeight) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Add Material Details" });
    }

    if (challanFor === "branch" && !to) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Select Destination" });
    }

    var handlingBranchArray = [];
    if (challanFor === "multiBranch" && handlingBranch) {
      handlingBranchArray = Array.isArray(handlingBranch) ? handlingBranch : [handlingBranch];
    }

    const NOPArray = Array.isArray(NOP) ? NOP : [NOP];
    const lrArray = Array.isArray(lrNumber) ? lrNumber : [lrNumber];
    const actualWeightArray = Array.isArray(actualWeight) ? actualWeight : [actualWeight];
    const chargedWeightArray = Array.isArray(chargedWeight) ? chargedWeight : [chargedWeight];

    const material = [];

    //checking if none of pkgh, actual weight, charged weight is 0
    for (i = 0; i < lrArray.length; i++) {
      if (parseInt(NOPArray[i]) < 1) {
        await session.abortTransaction()
        return res.status(400).send({ message: "You Cannot Recieve 0 PKG" })
      }

      if (parseInt(actualWeightArray[i]) < 1) {
        await session.abortTransaction()
        return res.status(400).send({ message: "You Cannot Recieve 0 Actual Weight" })
      }

      if (parseInt(chargedWeightArray[i]) < 1) {
        await session.abortTransaction()
        return res.status(400).send({ message: "You Cannot Recieve 0 Charged Weight" })
      }
    }


    for (let i = 0; i < NOPArray.length; i++) {
      const lrData = await lr.findById(lrArray[i]).populate("to").populate("challans").session(session)

      //we need to checheck weight before creating challan in two cases.
      //1) When Challan is Created at Booking Station
      //2) When the challan is created for LR at transfer station. If its created at transfer station then only the quantity receievd in Lorry Arrival can be shipped.

      var totalBalanceActualWeight = 0;
      var totalBalanceChargedWeight = 0;
      var maxNOP = 0;

      //when booking branch and user branch is same
      if (req.user.godown.id.toString() === lrData.bookingGodown.toString()) {
        totalBalanceActualWeight = lrData.materialStatus.atBookingGodown.actualWeight;
        totalBalanceChargedWeight = lrData.materialStatus.atBookingGodown.chargedWeight;
        maxNOP = lrData.materialStatus.atBookingGodown.qty;
      } else {

        //when challan is made for material transfer

        const data = await req.user.godown.stock.find((element) => element.lrNumber.toString() === lrArray[i].toString() && element.transfer === true)
        totalBalanceActualWeight = data.actualWeight
        totalBalanceChargedWeight = data.chargedWeight
        maxNOP = data.qty
      }

      if (parseFloat(totalBalanceActualWeight) < parseFloat(actualWeightArray[i])) {
        await session.abortTransaction()
        return res.status(400).send({ message: `Actual Weight Cannot be More than Total Bal Available in LR Number: ${lrData.lrNumber}` });
      } else if (parseFloat(totalBalanceChargedWeight) < parseFloat(chargedWeightArray[i])) {
        await session.abortTransaction()
        return res.status(400).send({ message: `Charged Weight Cannot be More than Total Bal Available in LR Number: ${lrData.lrNumber}` });
      } else if (parseInt(maxNOP) < parseInt(NOPArray[i])) {
        await session.abortTransaction()
        return res.status(400).send({ message: `No. of Packages Cannot be More than Total Bal Available in LR Number: ${lrData.lrNumber}` });

        //checking if max qty is sent.i f max qty is not sent than 100% weight cannot be sent
      } else if (
        (maxNOP === parseInt(NOPArray[i])) &&
        (parseFloat(totalBalanceActualWeight) !== parseFloat(actualWeightArray[i]) ||
          parseFloat(totalBalanceChargedWeight) !== parseFloat(chargedWeightArray[i]))
      ) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Actual Weight & Charged Weight Needs To Be Equal to Max Weight Available Since You Have Entered Max PKG" })
      } else if (
        (parseInt(maxNOP) !== parseInt(NOPArray[i])) &&
        (parseFloat(totalBalanceActualWeight) === parseFloat(actualWeightArray[i]) ||
          parseFloat(totalBalanceChargedWeight) === parseFloat(chargedWeightArray[i]))
      ) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Actual Weight & Charged Weight Cannot Be Set At Max There Are Balance PKG Quantities" })
      }

    }




    //inserting LR Wise Material in Challan
    for (k = 0; k < NOPArray.length; k++) {
      const lrDATA = await lr.findById(lrArray[k]).session(session)
      const individualMaterial = {
        lrNumber: lrArray[k],
        qty: NOPArray[k],
        actualWeight: actualWeightArray[k],
        chargedWeight: chargedWeightArray[k],
        handlingBranch: handlingBranchArray[k] || req.body.to,
        transfer: lrDATA.bookingGodown.toString() !== req.user.godown.id.toString(),
      };
      material.push(individualMaterial);
    }



    const newChallanNumber = await updatePrintNumber(db, session, req.user, "challanCALC", challanNumberNew)




    const newChallanData = {
      number: newChallanNumber,
      date: challanDate,
      for: challanFor,
      from: req.user.godown.id,
      vehicle: vehicle,
      material: material,
      createdBy: req.user.id,
      financialYear: req.user.financialYear
    };

    if (challanFor === "branch") {
      newChallanData.to = to;
    }

    const newChallan = new challan(newChallanData);

    // Save the new Challan document
    const savedChallan = await newChallan.save({ session });
    for (let i = 0; i < NOPArray.length; i++) {

      //Updating Status in LR


      const lrDATA = await lr.findById(lrArray[i]).session(session)

      //updating LR Status based on users godown
      if (lrDATA.bookingGodown.toString() !== req.user.godown.id.toString()) {
        //reducing material from status at booking godown
        lrDATA.materialStatus.transfer.actualWeight = parseFloat(lrDATA.materialStatus.transfer.actualWeight) - parseFloat(actualWeightArray[i])
        lrDATA.materialStatus.transfer.chargedWeight = parseFloat(lrDATA.materialStatus.transfer.chargedWeight) - parseFloat(chargedWeightArray[i])
        lrDATA.materialStatus.transfer.qty = parseInt(lrDATA.materialStatus.transfer.qty) - parseInt(NOPArray[i])

      } else {
        //reducing material from status at booking godown
        lrDATA.materialStatus.atBookingGodown.actualWeight = parseFloat(lrDATA.materialStatus.atBookingGodown.actualWeight) - parseFloat(actualWeightArray[i])
        lrDATA.materialStatus.atBookingGodown.chargedWeight = parseFloat(lrDATA.materialStatus.atBookingGodown.chargedWeight) - parseFloat(chargedWeightArray[i])
        lrDATA.materialStatus.atBookingGodown.qty = parseInt(lrDATA.materialStatus.atBookingGodown.qty) - parseInt(NOPArray[i])
      }


      //adding material reduced to dispatched
      lrDATA.materialStatus.dispatched.actualWeight = parseFloat(lrDATA.materialStatus.dispatched.actualWeight) + parseFloat(actualWeightArray[i])
      lrDATA.materialStatus.dispatched.chargedWeight = parseFloat(lrDATA.materialStatus.dispatched.chargedWeight) + parseFloat(chargedWeightArray[i])
      lrDATA.materialStatus.dispatched.qty = parseInt(lrDATA.materialStatus.dispatched.qty) + parseInt(NOPArray[i])





      //pushing challan in LR
      lrDATA.challans.push(savedChallan.id)
      await lrDATA.save()



      //updating balance qty in lorry arrival
      //start
      // ...

      if (lrDATA.bookingGodown.toString() !== req.user.godown.id.toString()) {
        const updateGodown = await godown.findById(req.user.godown.id).session(session)

        const filteredGodown = updateGodown.stock.find((element) => element.lrNumber.toString() === lrArray[i].toString() && element.transfer === true);

        filteredGodown.qty -= parseInt(NOPArray[i])
        filteredGodown.actualWeight -= parseInt(actualWeightArray[i])
        filteredGodown.chargedWeight -= parseInt(chargedWeightArray[i])

        await updateGodown.save()
      }

    }
    //pushing challan in branch
    await branch.findByIdAndUpdate(req.user.branch.id, { $push: { challans: savedChallan.id } }).session(session)
    await godown.findByIdAndUpdate(req.user.godown.id, { $push: { challans: savedChallan.id } }).session(session)
    //pushing challan in user
    await user.findByIdAndUpdate(req.user.id, { $push: { challans: savedChallan.id } }).session(session)





    await session.commitTransaction()
    return res.status(200).send({ message: "Challan created successfully" });
  } catch (err) {
    await session.abortTransaction()
    console.error("An error occurred:", err);
    return res.sendStatus(500);
  } finally {
    session.endSession()
  }
})



//sends challan data to set up edit form
Route.get("/transactions/booking/challan/get-challan-detail", async (req, res) => {
  const db = req.dbConnection
  const challans = db.model("challans", challanSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const challanDATA = await challans.findById(req.query.id).populate("material.lrNumber")
  const maxDATA = []
  if (challanDATA.lorryArrival) {
    return res.status(400).send({ message: "This Challan Cant Be Edited Since Lorry Arrival Already Made For This" })
  }
  for (const data of challanDATA.material) {
    const temp = await lr.findById(data.lrNumber.id)
    if (temp.bookingGodown.toString() === req.user.godown.id.toString()) {
      const newObject = {
        maxNOP: temp.materialStatus.atBookingGodown.qty + data.qty,
        maxActualWeight: temp.materialStatus.atBookingGodown.actualWeight + data.actualWeight,
        maxChargedWeight: temp.materialStatus.atBookingGodown.chargedWeight + data.chargedWeight,
      }
      maxDATA.push(newObject)
    } else {

      const filteredData = req.user.godown.stock.find((element) => element.lrNumber.toString() === temp.id.toString() && element.transfer === true)

      var totalQTY = filteredData.qty
      var totalActuals = filteredData.actualWeight
      var totalCharged = filteredData.chargedWeight
      const newObject = {
        maxNOP: totalQTY + data.qty,
        maxActualWeight: totalActuals + data.actualWeight,
        maxChargedWeight: totalCharged + data.chargedWeight,
      }
      maxDATA.push(newObject)

    }
  }
  // come back after setting user godown and updating lorry arrival in godown instead of branch
  return res.status(200).send({ challanDATA, maxDATA })
})


Route.post("/transactions/booking/challan/update", async (req, res) => {
  const db = req.dbConnection
  const lr = db.model("lorry-reciepts", lrSchema)
  const branch = db.model("branches", branchSchema)
  const challan = db.model("challans", challanSchema)
  const user = db.model("users", userSchema)
  const cities = db.model("cities", citiesSchema)
  const godown = db.model("godowns", godownSchema)
  const { challanNumberNew, challanNumber, challanDate, challanFor, from, to, vehicle, handlingBranch, type, lrNumber, NOP, actualWeight, chargedWeight } = req.body;
  const session = await db.startSession()
  try {
    session.startTransaction()

    //form validations
    if (!challanNumber) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Enter a Valid Challan Number" });
    }

    if (!challanDate) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Select a Valid Date" });
    }

    if (!challanFor) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Select Challan For" });
    }

    if (!vehicle) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Select a Valid Vehicle Number" });
    }

    if (!lrNumber || !NOP || !actualWeight || !chargedWeight) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Add Material Details" });
    }

    if (challanFor === "branch" && !to) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Select Destination" });
    }

    //converting all to array
    var handlingBranchArray = [];
    if (challanFor === "multiBranch" && handlingBranch) {
      handlingBranchArray = Array.isArray(handlingBranch) ? handlingBranch : [handlingBranch];
    }

    const NOPArray = Array.isArray(NOP) ? NOP : [NOP];
    const lrArray = Array.isArray(lrNumber) ? lrNumber : [lrNumber];
    const actualWeightArray = Array.isArray(actualWeight) ? actualWeight : [actualWeight];
    const chargedWeightArray = Array.isArray(chargedWeight) ? chargedWeight : [chargedWeight];
    const typeArray = Array.isArray(type) ? type : [type]


    //checking if none of pkgh, actual weight, charged weight is 0
    for (i = 0; i < lrArray.length; i++) {
      if (parseInt(NOPArray[i]) < 1) {
        await session.abortTransaction()
        return res.status(400).send({ message: "You Cannot Recieve 0 PKG" })
      }

      if (parseInt(actualWeightArray[i]) < 1) {
        await session.abortTransaction()
        return res.status(400).send({ message: "You Cannot Recieve 0 Actual Weight" })
      }

      if (parseInt(chargedWeightArray[i]) < 1) {
        await session.abortTransaction()
        return res.status(400).send({ message: "You Cannot Recieve 0 Charged Weight" })
      }
    }


    // validating that correct material data is arrived
    const challanDATA = await challan.findById(challanNumber).session()
    if (challanDATA.lorryArrival) {
      await session.abortTransaction()
      res.status(400).send({ message: "This Challan Cant Be Edited Since Lorry Arrival Already Made For This" })
    }
    // this loop is used for form validation
    for (i = 0; i < NOPArray.length; i++) {
      const lrDATA = await lr.findById(lrArray[i]).session()
      //indicates that material in challan is top be taken from booking godown
      if (lrDATA.bookingGodown.toString() === req.user.godown.id.toString()) {
        //indicates that material in challan is top be taken from booking godown
        const data = await challanDATA.material.find(element => element.lrNumber.toString() === lrArray[i].toString())

        if (data) {
          //when material of that lr is already added in the challanm, so max qty will be qty at booking godown + that was previously added to that same challan
          const maxNOP = lrDATA.materialStatus.atBookingGodown.qty + data.qty
          const maxActualWeight = lrDATA.materialStatus.atBookingGodown.actualWeight + data.actualWeight
          const maxChargedWeight = lrDATA.materialStatus.atBookingGodown.chargedWeight + data.chargedWeight
          if (parseInt(maxNOP) < parseInt(NOPArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Packages Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if (parseInt(maxActualWeight) < parseInt(actualWeightArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Actual Weight Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if (maxChargedWeight < parseInt(chargedWeightArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Charged Weight Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if ((maxNOP === parseInt(NOPArray[i])) && (maxActualWeight !== parseInt(actualWeightArray[i]) || maxChargedWeight !== parseInt(chargedWeightArray[i]))) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send 100% Packages When Actual Weight & Charged Weight Is Not Sent 100% in LR Number: ${lrDATA.lrNumber}` })
          } else if ((maxActualWeight === parseInt(actualWeightArray[i]) || maxChargedWeight === parseInt(chargedWeightArray[i])) && (maxNOP !== parseInt(NOPArray[i]))) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send 100% Actual Weight & Charged Weight When 100% Packages are not sent in LR Number: ${lrDATA.lrNumber}` })
          }
        } else {
          // when material of that lr is not already added in lr and new lr entry is made, so max qty that can be addded will be equal to aavilable at booking godown
          const maxNOP = lrDATA.materialStatus.atBookingGodown.qty
          const maxActualWeight = lrDATA.materialStatus.atBookingGodown.actualWeight
          const maxChargedWeight = lrDATA.materialStatus.atBookingGodown.chargedWeight

          if (parseInt(maxNOP) < parseInt(NOPArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Packages Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if (parseInt(maxActualWeight) < parseInt(actualWeightArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Actual Weight Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if (maxChargedWeight < parseInt(chargedWeightArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Charged Weight Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if ((maxNOP === parseInt(NOPArray[i])) && (maxActualWeight !== parseInt(actualWeightArray[i]) || maxChargedWeight !== parseInt(chargedWeightArray[i]))) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send 100% Packages When Actual Weight & Charged Weight Is Not Sent 100% in LR Number: ${lrDATA.lrNumber}` })
          } else if ((maxActualWeight === parseInt(actualWeightArray[i]) || maxChargedWeight === parseInt(chargedWeightArray[i])) && (maxNOP !== parseInt(NOPArray[i]))) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send 100% Actual Weight & Charged Weight When 100% Packages are not sent in LR Number: ${lrDATA.lrNumber}` })
          }
        }

      } else {
        // indicates that material in that challan was added for stock transfer
        const data = await challanDATA.material.find(element => element.lrNumber.toString() === lrArray[i].toString())
        if (data) {
          //when material of that lr is already added in the challanm, so max qty will be stock at transfer godown + that was previously added to that same challan
          const branchStock = req.user.godown.stock.find(element => element.lrNumber.toString() === lrArray[i].toString() && element.transfer === true)
          var totalQTY = branchStock.qty
          var totalActuals = branchStock.actualWeight
          var totalCharged = branchStock.chargedWeight
          const maxNOP = totalQTY + data.qty
          const maxActualWeight = totalActuals + data.actualWeight
          const maxChargedWeight = totalCharged + data.chargedWeight

          if (parseInt(maxNOP) < parseInt(NOPArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Packages Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if (parseInt(maxActualWeight) < parseInt(actualWeightArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Actual Weight Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if (maxChargedWeight < parseInt(chargedWeightArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Charged Weight Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if ((maxNOP === parseInt(NOPArray[i])) && (maxActualWeight !== parseInt(actualWeightArray[i]) || maxChargedWeight !== parseInt(chargedWeightArray[i]))) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send 100% Packages When Actual Weight & Charged Weight Is Not Sent 100% in LR Number: ${lrDATA.lrNumber}` })
          } else if ((maxActualWeight === parseInt(actualWeightArray[i]) || maxChargedWeight === parseInt(chargedWeightArray[i])) && (maxNOP !== parseInt(NOPArray[i]))) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send 100% Actual Weight & Charged Weight When 100% Packages are not sent in LR Number: ${lrDATA.lrNumber}` })
          }
        } else {
          // when material of that lr is not already added in lr and new lr entry is made, so max qty that can be addded will be equal to stock avilable at transfer godown
          const branchStock = req.user.godown.stock.find(element => element.lrNumber.toString() === lrArray[i].toString() && element.transfer === true)
          var totalQTY = branchStock.qty
          var totalActuals = branchStock.actualWeight
          var totalCharged = branchStock.chargedWeight

          const maxNOP = totalQTY
          const maxActualWeight = totalActuals
          const maxChargedWeight = totalCharged
          if (parseInt(maxNOP) < parseInt(NOPArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Packages Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if (parseInt(maxActualWeight) < parseInt(actualWeightArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Actual Weight Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if (maxChargedWeight < parseInt(chargedWeightArray[i])) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send More Charged Weight Then Available With You in LR Number: ${lrDATA.lrNumber}` })
          } else if ((maxNOP === parseInt(NOPArray[i])) && (maxActualWeight !== parseInt(actualWeightArray[i]) || maxChargedWeight !== parseInt(chargedWeightArray[i]))) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send 100% Packages When Actual Weight & Charged Weight Is Not Sent 100% in LR Number: ${lrDATA.lrNumber}` })
          } else if ((maxActualWeight === parseInt(actualWeightArray[i]) || maxChargedWeight === parseInt(chargedWeightArray[i])) && (maxNOP !== parseInt(NOPArray[i]))) {
            await session.abortTransaction()
            return res.status(400).send({ message: `You Cannot Send 100% Actual Weight & Charged Weight When 100% Packages are not sent in LR Number: ${lrDATA.lrNumber}` })
          }
        }

      }
    }


    //all stock data has been validated until here, so now we will proceed on update part
    //this loop is used for form updation
    const updatedIndex = []
    const newObjectIndex = []
    for (i = 0; i < lrArray.length; i++) {
      const lrDATA = await lr.findById(lrArray[i]).session(session)
      //this indicates that lr is of booking godown itself so we just have to update material status in lr and challan
      if (lrDATA.bookingGodown.toString() === req.user.godown.id.toString()) {
        if (typeArray[i] === "OLD") {
          //first we find index of the lr in challan
          const index = challanDATA.material.findIndex(element => element.lrNumber.toString() === lrArray[i])

          //now we save old challan values in below variable
          const oldNOP = challanDATA.material[index].qty
          const oldActual = challanDATA.material[index].actualWeight
          const oldChargedWeight = challanDATA.material[index].chargedWeight

          //we add back previously dispacthed in this challan to booking and remove that from dispatched status
          lrDATA.materialStatus.atBookingGodown.qty = lrDATA.materialStatus.atBookingGodown.qty + oldNOP
          lrDATA.materialStatus.atBookingGodown.actualWeight = lrDATA.materialStatus.atBookingGodown.actualWeight + oldActual
          lrDATA.materialStatus.atBookingGodown.chargedWeight = lrDATA.materialStatus.atBookingGodown.chargedWeight + oldChargedWeight
          await lrDATA.save()
          // we remove from dispatched now
          lrDATA.materialStatus.dispatched.qty = lrDATA.materialStatus.dispatched.qty - oldNOP
          lrDATA.materialStatus.dispatched.actualWeight = lrDATA.materialStatus.dispatched.actualWeight - oldActual
          lrDATA.materialStatus.dispatched.chargedWeight = lrDATA.materialStatus.dispatched.chargedWeight - oldChargedWeight
          await lrDATA.save()
          // now we add back new quantities to at booking godown and dispatched
          //we subtract material dispactehd here
          lrDATA.materialStatus.atBookingGodown.qty = lrDATA.materialStatus.atBookingGodown.qty - parseInt(NOPArray[i])
          lrDATA.materialStatus.atBookingGodown.actualWeight = lrDATA.materialStatus.atBookingGodown.actualWeight - parseInt(actualWeightArray[i])
          lrDATA.materialStatus.atBookingGodown.chargedWeight = lrDATA.materialStatus.atBookingGodown.chargedWeight - parseInt(chargedWeightArray[i])
          await lrDATA.save()
          // we add now in dispatched
          lrDATA.materialStatus.dispatched.qty = lrDATA.materialStatus.dispatched.qty + parseInt(NOPArray[i])
          lrDATA.materialStatus.dispatched.actualWeight = lrDATA.materialStatus.dispatched.actualWeight + parseInt(actualWeightArray[i])
          lrDATA.materialStatus.dispatched.chargedWeight = lrDATA.materialStatus.dispatched.chargedWeight + parseInt(chargedWeightArray[i])
          await lrDATA.save()
          // now we update this in challan
          challanDATA.material[index].qty = NOPArray[i]
          challanDATA.material[index].actualWeight = actualWeightArray[i]
          challanDATA.material[index].chargedWeight = chargedWeightArray[i]
          await challanDATA.save()
          //now we update this index in updatedIndex Array since later we will check which of the old index wasnt updated (which indicates that lr has been removed)
          updatedIndex.push(index)
        } else {
          newObjectIndex.push(i)
        }
      } else {
        // this indicates that lr in challan was of transfer so we also need to update stock at godown, along with material status in lr
        if (typeArray[i] === "OLD") {

          //removbing old transfer dispatched from dispatched 
          //now we save old challan values in below variable
          const index = challanDATA.material.findIndex(element => element.lrNumber.toString() === lrArray[i])
          const oldNOP = challanDATA.material[index].qty
          const oldActual = challanDATA.material[index].actualWeight
          const oldChargedWeight = challanDATA.material[index].chargedWeight


          // we remove from dispatched now
          lrDATA.materialStatus.dispatched.qty = lrDATA.materialStatus.dispatched.qty - oldNOP
          lrDATA.materialStatus.dispatched.actualWeight = lrDATA.materialStatus.dispatched.actualWeight - oldActual
          lrDATA.materialStatus.dispatched.chargedWeight = lrDATA.materialStatus.dispatched.chargedWeight - oldChargedWeight
          await lrDATA.save()
          //adding back to transfer
          lrDATA.materialStatus.transfer.qty = lrDATA.materialStatus.transfer.qty + oldNOP
          lrDATA.materialStatus.transfer.actualWeight = lrDATA.materialStatus.transfer.actualWeight + oldActual
          lrDATA.materialStatus.transfer.chargedWeight = lrDATA.materialStatus.transfer.chargedWeight + oldChargedWeight
          await lrDATA.save()

          // now we will add it back in stock at godown
          const updateGodown = await godown.findById(req.user.godown.id).session(session)
          const filtered = await updateGodown.stock.find(element => element.lrNumber.toString() === lrArray[i] && element.transfer === true)
          filtered.qty += oldNOP
          filtered.actualWeight += oldActual
          filtered.chargedWeight += oldChargedWeight
          filtered.transfer = true
          await updateGodown.save()
          //all reversed

          //now re-entry

          //now we will add back updated dispatcched and stock
          lrDATA.materialStatus.dispatched.qty = lrDATA.materialStatus.dispatched.qty + parseInt(NOPArray[i])
          lrDATA.materialStatus.dispatched.actualWeight = lrDATA.materialStatus.dispatched.actualWeight + parseInt(actualWeightArray[i])
          lrDATA.materialStatus.dispatched.chargedWeight = lrDATA.materialStatus.dispatched.chargedWeight + parseInt(chargedWeightArray[i])
          await lrDATA.save()
          //reducing from transfer
          lrDATA.materialStatus.transfer.qty = lrDATA.materialStatus.transfer.qty - parseInt(NOPArray[i])
          lrDATA.materialStatus.transfer.actualWeight = lrDATA.materialStatus.transfer.actualWeight - parseInt(actualWeightArray[i])
          lrDATA.materialStatus.transfer.chargedWeight = lrDATA.materialStatus.transfer.chargedWeight - parseInt(chargedWeightArray[i])
          await lrDATA.save()
          // now we reduce stock

          const filteredGodown = updateGodown.stock.find((element) => element.lrNumber.toString() === lrArray[i].toString() && element.transfer === true);

          filteredGodown.qty -= parseInt(NOPArray[i])
          filteredGodown.actualWeight -= parseInt(actualWeightArray[i])
          filteredGodown.chargedWeight -= parseInt(chargedWeightArray[i])

          await updateGodown.save()

          updatedIndex.push(index)

          await lrDATA.save()
          // now we update this in challan
          challanDATA.material[index].qty = NOPArray[i]
          challanDATA.material[index].actualWeight = actualWeightArray[i]
          challanDATA.material[index].chargedWeight = chargedWeightArray[i]

        } else {
          newObjectIndex.push(i)
        }
      }
      await challanDATA.save()
      await lrDATA.save()
    }

    //all old documents updated so new will remove documents if any
    //this loop will check if any lr is removed from challan

    for (i = 0; i < challanDATA.material.length; i++) {
      const check = updatedIndex.find(element => element === i)
      if (typeof check === "undefined") {

        const NOPDelete = challanDATA.material[i].qty
        const actualWeightDelete = challanDATA.material[i].actualWeight
        const chargedWeightDelete = challanDATA.material[i].chargedWeight

        //first we remove this from dispatched
        const lrDATA = await lr.findById(challanDATA.material[i].lrNumber).session(session)
        lrDATA.materialStatus.dispatched.qty = lrDATA.materialStatus.dispatched.qty - NOPDelete
        lrDATA.materialStatus.dispatched.actualWeight = lrDATA.materialStatus.dispatched.actualWeight - actualWeightDelete
        lrDATA.materialStatus.dispatched.chargedWeight = lrDATA.materialStatus.dispatched.chargedWeight - chargedWeightDelete
        await lrDATA.save()
        // now we add this back to lr or stock based on where challan was made
        if (lrDATA.bookingGodown.toString() === req.user.godown.id.toString()) {
          lrDATA.materialStatus.atBookingGodown.qty = lrDATA.materialStatus.atBookingGodown.qty + NOPDelete
          lrDATA.materialStatus.atBookingGodown.actualWeight = lrDATA.materialStatus.atBookingGodown.actualWeight + actualWeightDelete
          lrDATA.materialStatus.atBookingGodown.chargedWeight = lrDATA.materialStatus.atBookingGodown.chargedWeight + chargedWeightDelete
          await lrDATA.save()
        } else {
          //added to transfer in LR material status
          lrDATA.materialStatus.transfer.qty = lrDATA.materialStatus.transfer.qty + NOPDelete
          lrDATA.materialStatus.transfer.actualWeight = lrDATA.materialStatus.transfer.actualWeight + actualWeightDelete
          lrDATA.materialStatus.transfer.chargedWeight = lrDATA.materialStatus.transfer.chargedWeight + chargedWeightDelete
          await lrDATA.save()

          // now we will add it to stock at godown

          const updateGodown = await godown.findById(req.user.godown.id).session(session)
          const filtered = updateGodown.stock.find(element => element.transfer === true && element.lrNumber.toString() === lrDATA.id.toString())
          filtered.qty = filtered.qty + NOPDelete
          filtered.actualWeight = filtered.actualWeight + actualWeightDelete
          filtered.chargedWeight = filtered.chargedWeight + chargedWeightDelete
          await updateGodown.save()

        }

        // since all stock updated now we will pull this objkect from challan
        const newFiltered = challanDATA.material.find(element => element.lrNumber.toString() === lrDATA.id)
        await challanDATA.material.pull(newFiltered)
        await lrDATA.save()
        await challanDATA.save()

      }


    }



    // now since all previpusly held documents are updated now we need to update it for new documents that are added to challans
    //this loop handles addition of new docs to lr

    for (i = 0; i < newObjectIndex.length; i++) {
      const lrDATA = await lr.findById(lrArray[newObjectIndex[i]]).session(session)
      const newObject = {
        lrNumber: lrArray[newObjectIndex[i]],
        qty: NOPArray[newObjectIndex[i]],
        actualWeight: actualWeightArray[newObjectIndex[i]],
        chargedWeight: chargedWeightArray[newObjectIndex[i]],
        handlingBranch: handlingBranchArray[newObjectIndex[i]] || req.body.to,
        transfer: lrDATA.bookingGodown.toString() !== req.user.godown.id.toString()
      }

      challanDATA.material.push(newObject)

      //updating this stock detals in lr
      // first we add this to dispatched
      lrDATA.materialStatus.dispatched.qty = lrDATA.materialStatus.dispatched.qty + NOPArray[newObjectIndex[i]]
      lrDATA.materialStatus.dispatched.actualWeight = lrDATA.materialStatus.dispatched.actualWeight + actualWeightArray[newObjectIndex[i]]
      lrDATA.materialStatus.dispatched.chargedWeight = lrDATA.materialStatus.dispatched.chargedWeight + chargedWeightArray[newObjectIndex[i]]
      await lrDATA.save()
      //now we subtract it from booking godown if challan was made at booking godown
      if (lrDATA.bookingGodown.toString() === req.user.godown.id.toString()) {
        //indicates that lr was created at booking godown so we will reduce it from booking godown stock in material status
        lrDATA.materialStatus.atBookingGodown.qty = lrDATA.materialStatus.atBookingGodown.qty - NOPArray[newObjectIndex[i]]
        lrDATA.materialStatus.atBookingGodown.actualWeight = lrDATA.materialStatus.atBookingGodown.actualWeight - actualWeightArray[newObjectIndex[i]]
        lrDATA.materialStatus.atBookingGodown.chargedWeight = lrDATA.materialStatus.atBookingGodown.chargedWeight - chargedWeightArray[newObjectIndex[i]]
        await lrDATA.save()
      } else {
        //this indicates that material added in challan was of transfer so we have to reduce  it from transfer stock in godown, as well as in LR
        lrDATA.materialStatus.transfer.qty = lrDATA.materialStatus.transfer.qty - NOPArray[newObjectIndex[i]]
        lrDATA.materialStatus.transfer.actualWeight = lrDATA.materialStatus.transfer.actualWeight - actualWeightArray[newObjectIndex[i]]
        lrDATA.materialStatus.transfer.chargedWeight = lrDATA.materialStatus.transfer.chargedWeight - chargedWeightArray[newObjectIndex[i]]
        await lrDATA.save()


        const updateGodown = await godown.findById(req.user.godown.id).session(session)
        const filteredGodown = updateGodown.stock.find((element) => element.lrNumber.toString() === lrArray[newObjectIndex[i]].toString() && element.transfer === true);

        filteredGodown.qty -= parseInt(NOPArray[i])
        filteredGodown.actualWeight -= parseInt(actualWeightArray[i])
        filteredGodown.chargedWeight -= parseInt(chargedWeightArray[i])
        await updateGodown.save();


      }

      await lrDATA.save()

    }


    //now we will update basic challan details here
    challanDATA.vehicle = vehicle
    if (challanFor === "branch") {
      for (i = 0; i < NOPArray.length; i++) {
        challanDATA.material[i].handlingBranch = to
      }
      challanDATA.to = to
    } else {
      for (i = 0; i < NOPArray.length; i++) {
        challanDATA.material[i].handlingBranch = handlingBranchArray[i]
      }
    }

    challanDATA.date = challanDate
    challanDATA.for = challanFor


    await challanDATA.save()
    await session.commitTransaction()
    res.sendStatus(200)

  } catch (err) {
    await session.abortTransaction()
    console.error("An error occurred:", err);
    return res.sendStatus(500);
  } finally {
    session.endSession()
  }
})


Route.get("/transactions/booking/challan/delete", async (req, res) => {
  const db = req.dbConnection
  const godown = db.model("godowns", godownSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const challan = db.model("challans", challanSchema)
  const session = await db.startSession()

  try {
    session.startTransaction()
    const challanDATA = await challan.findById(req.query.id).session(session)

    if (challanDATA.lorryArrival) {
      await session.abortTransaction()
      return res.status(400).send({ message: "This Challan Cant Be Deleted Since Lorry Arrival is Done" })
    } else {
      for (i = 0; i < challanDATA.material.length; i++) {
        const materialFound = await challanDATA.materialFound.find(element => element.lrNumber.toString() === challanDATA.material[i].lrNumber.toString())
        const lrDATA = await lr.findById(challanDATA.material[i].lrNumber).session(session)

        let maxNOP = challanDATA.material[i].qty
        let maxActualWeight = challanDATA.material[i].actualWeight
        let maxChargedWeight = challanDATA.material[i].chargedWeight

        if (materialFound) {
          maxNOP -= materialFound.qty
          maxActualWeight -= materialFound.actualWeight
          maxChargedWeight -= materialFound.chargedWeight
        }
        //removing stock from dispatched
        lrDATA.materialStatus.dispatched.qty -= maxNOP
        lrDATA.materialStatus.dispatched.actualWeight -= maxActualWeight
        lrDATA.materialStatus.dispatched.chargedWeight -= maxChargedWeight

        if (lrDATA.bookingGodown.toString() === req.user.godown.id) {
          //adding back to booking godown stock
          lrDATA.materialStatus.atBookingGodown.qty += maxNOP
          lrDATA.materialStatus.atBookingGodown.actualWeight += maxActualWeight
          lrDATA.materialStatus.atBookingGodown.chargedWeight += maxChargedWeight

        } else {
          //adding back to transfer godown stock
          const godownDATA = await godown.findById(req.user.godown.id).session(session)
          const filtered = godownDATA.stock.find(element => element.lrNumber.toString() === lrDATA.id.toString() && element.transfer === true)
          filtered.qty += maxNOP
          filtered.actualWeight += maxActualWeight
          filtered.chargedWeight += maxChargedWeight
          await godownDATA.save()
        }
        await lrDATA.save()

      }
    }

    await challan.findByIdAndDelete(req.query.id).session(session)
    await session.commitTransaction()
    res.sendStatus(200)

  } catch (err) {
    await session.abortTransaction()
    console.error("An error occurred:", err);
    return res.sendStatus(500);
  } finally {
    session.endSession()
  }

})

Route.get("/transactions/booking/challan/get-vehicle-details", async (req, res) => {
  const db = req.dbConnection
  const vehicle = db.model("vehicles", vehicleDataSchema)
  const owner = db.model("owners", ownerSchema)
  const driver = db.model("drivers", driverSchema)
  const broker = db.model("brokers", brokerSchema)
  const vehicleDATA = await vehicle.findById(req.query.vehicle).populate("owner").populate("driver").populate("broker")
  return res.status(200).send(vehicleDATA)
})

module.exports = Route;
