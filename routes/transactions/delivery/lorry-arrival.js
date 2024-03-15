const express = require("express");
const Route = express.Router();

const getCurrentFinancialYear = require("../../../custom_modules/financial-year");


const challanSchema = require("../../../models/transactions/bookings/challan");
const lrSchema = require("../../../models/transactions/bookings/lorry-reciept");
const laSchema = require("../../../models/transactions/delivery/lorry-arrival");
const branchSchema = require("../../../models/masters/locations/branch");
const citiesSchema = require("../../../models/masters/locations/cities");
const usersSchema = require("../../../models/authentication/user");
const vehicleSchema = require("../../../models/masters/vehicles/vehicles")
const godownSchema = require("../../../models/masters/locations/godowns")
const fySchema = require("../../../models/financialYear")
const {getPrintNumber, updatePrintNumber} = require("../../../custom_modules/serialCalculator")
Route.get("/transactions/delivery/lorry-arrival", async (req, res) => {
  const db = req.dbConnection
  const challan = db.model("challans", challanSchema)
  const branch = db.model("branches", branchSchema)
  const vehicles = db.model("vehicles", vehicleSchema)
  const fy = db.model("financial-years", fySchema)
  const allChallan = await challan.find({ active: true });
  const la = db.model("lorry-arrivals", laSchema)
  var challanArray = [];
  for (const challanID of allChallan) {
    const challanData = await challan.findById(challanID);
    const newChallanData = await challanData.material.filter(
      (element) =>
        element.handlingBranch.toString() === req.user.branch.id.toString()
    );
    if (newChallanData.length >= 1) {
      challanArray.push(challanID.id);
    }
  }
  const branchData = await branch.find({})
  const laDATA = await la.find({ createdAtGodown: req.user.godown.id, financialYear : req.user.financialYear }).populate("vehicle").sort({_id : -1})
  const sendData = await challan.find({ _id: { $in: challanArray } })


   //getting current arrivalNumber
   const fyData = await fy.findOne({ _id: req.user.financialYear })
   const arrivalNumber = await getPrintNumber(db, req.user, "laCALC")

  res.render("transactions/delivery/lorry-arrival", {arrivalNumber, challanData: sendData, branchData: branchData, laDATA: laDATA });
});


Route.get("/transactions/delivery/lorry-arrival/get-challan-details", async (req, res) => {
  const db = req.dbConnection
  const challan = db.model("challans", challanSchema)
  const vehicle = db.model("vehicles", vehicleSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  try {
    const challanData = await challan
      .findById(req.query.challanID)
      .populate({ path: "material", populate: { path: "lrNumber" } })
      .populate("vehicle");

    if (challanData) {
      const matchingMaterials = challanData.material.filter(
        (element) => element.handlingBranch == req.user.branch.id
      );

      const extractedData = []
      if (matchingMaterials && matchingMaterials.length > 0) {
        // Extract the desired properties from matchingMaterials
        for (const material of matchingMaterials) {
          const filteredFound = challanData.materialFound.find(element => element.lrNumber.toString() === material.lrNumber.id.toString())
          if (filteredFound) {
            const lrData = {
              lrID: material.lrNumber.id,
              lrNumber: material.lrNumber.lrNumber,
              NOP: material.qty - filteredFound.qty,
              consignee: material.lrNumber.consigneeName,
              goodsDescription: material.lrNumber.goodsDescription,
              chargedWeight: material.chargedWeight - filteredFound.chargedWeight,
              actualWeight: material.actualWeight - filteredFound.actualWeight,
            }
            extractedData.push(lrData)
          } else {
            const lrData = {
              lrID: material.lrNumber.id,
              lrNumber: material.lrNumber.lrNumber,
              NOP: material.qty,
              consignee: material.lrNumber.consigneeName,
              goodsDescription: material.lrNumber.goodsDescription,
              chargedWeight: material.chargedWeight,
              actualWeight: material.actualWeight,
            }
            extractedData.push(lrData)
          }

        }

        // Send the extracted data as the response
        res.status(200).send({
          lrData: extractedData,
          vehicleNumber: challanData.vehicle.number,
          vehicleID: challanData.vehicle._id,
        });
      } else {
        console.log("No matching materials found.");
        // Send an empty array as a response when no matching materials are found
        res.status(200).send([]);
      }
    } else {
      console.log("Challan not found.");
      res.status(404).send("Challan not found.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).send("An error occurred.");
  }
}
);

Route.post("/transactions/delivery/lorry-arrival/new", async (req, res) => {
  const db = req.dbConnection
  const challan = db.model("challans", challanSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const la = db.model("lorry-arrivals", laSchema)
  const fy = db.model("financial-years", fySchema)
  const branch = db.model("branches", branchSchema)
  const users = db.model("users", usersSchema)
  const godown = db.model("godowns", godownSchema)
  const session = await db.startSession()
  const {
    arrivalNumberNew,
    arrivalNumber,
    arrivalDate,
    challanNumber,
    vehicleID,
    vehicleNumber,
    lrNumber,
    actualWeight,
    chargedWeight,
    materialFor,
    NOP,
  } = req.body;
  const lrArray = Array.isArray(lrNumber) ? lrNumber : [lrNumber];
  const chargedWeightArray = Array.isArray(chargedWeight) ? chargedWeight : [chargedWeight];
  const actualWeightArray = Array.isArray(actualWeight) ? actualWeight : [actualWeight];
  const materialForArray = Array.isArray(materialFor) ? materialFor : [materialFor];
  const NOPArray = Array.isArray(NOP) ? NOP : [NOP];
  const NOPSum = NOPArray.reduce((acc, qty) => acc + parseInt(qty, 10), 0);

  try {
    session.startTransaction()
    if (NOPSum < 1 || !lrArray || !chargedWeight || !actualWeightArray || !materialForArray) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Receive at least 1 Package" });
    } else if (!arrivalDate || !challanNumber || !vehicleID || !vehicleNumber) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Fill all Required Fields" });
    }
    // making sure that we dont recieve more materialn than sent in Challan
    const challanDATA = await challan.findById(challanNumber).session(session)
    var material = [];

    for (i = 0; i < lrArray.length; i++) {
      const filteredChallanData = await challanDATA.material.find((element) => element.lrNumber.toString() === lrArray[i].toString());
      let maxNOP = filteredChallanData.qty
      let maxActuals = filteredChallanData.actualWeight
      let maxCharged = filteredChallanData.chargedWeight
      const materialFound = challanDATA.materialFound.find((element) => element.lrNumber.toString() === lrArray[i].toString());
      if (materialFound) {
        maxNOP -= materialFound.qty
        maxActuals -= materialFound.actualWeight
        maxCharged -= materialFound.chargedWeight
      }
      const lrID = await lr.findById(lrArray[i]).session(session)

      if (maxNOP < NOPArray[i]) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Recieved QTY Cannot Be Greater than Dispatched in LR Number: " + lrID.lrNumber });
      } else if (maxActuals < actualWeightArray[i]) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Actual Weight Cannot Be Greater than Dispatched in LR Number: " + lrID.lrNumber });
      } else if (maxCharged < chargedWeightArray[i]) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Charged Weight Cannot Be Greater than Dispatched in LR Number: " + lrID.lrNumber });
      } else if (
        maxNOP > NOPArray[i] &&
        (maxCharged == chargedWeightArray[i] ||
          maxActuals == actualWeightArray[i])
      ) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Charged Weight & Actual Weight Cannot be recieved 100% if 100% of packages are not recieved " + lrID.lrNumber });
      } else if (
        maxNOP == NOPArray[i] &&
        (maxCharged != chargedWeightArray[i] ||
          maxActuals != actualWeightArray[i])
      ) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Charged Weight & Actual Weight Should be 100% Since 100% of the packages are recieved " + lrID.lrNumber });
      }

      //checking if material recieved previously for different reason
      const godownDATA = await godown.findById(req.user.godown.id).session(session)
      const filtered = godownDATA.stock.find(element => element.lrNumber.toString() === lrArray[i].toString())
      if (filtered && filtered.transfer === true && materialForArray[i] === "delivery") {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Receieve Material For Delivery Since Same LR Was Previously Recieved For Transfer in LR Number: ${lrID.lrNumber}` })
      } else if (filtered && filtered.transfer === false && materialForArray[i] === "transfer") {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Receieve Material For Transfer Since Same LR Was Previously Recieved For Delivery in LR Number: ${lrID.lrNumber}` })
      }

    }



    for (i = 0; i < lrArray.length; i++) {
      const lrID = await lr.findById(lrArray[i]).session(session)
      const filteredChallanData = await challanDATA.material.find((element) => element.lrNumber.toString() === lrArray[i].toString());
      const filteredFound = challanDATA.materialFound.find((element) => element.lrNumber.toString() === lrArray[i].toString());
      let maxNOP = filteredChallanData.qty 
      let maxActuals = filteredChallanData.actualWeight
      let maxCharged = filteredChallanData.chargedWeight
      if (filteredFound) {  
        maxNOP -= filteredFound.qty
        maxActuals -= filteredFound.actualWeight
        maxCharged -= filteredFound.chargedWeight
       }

      //checking for shortwage if yes we update it in lr if no we still update lr status
      if (maxNOP > NOPArray[i]) {
        //shortage calculation
        var shortNOP = maxNOP - NOPArray[i];
        var shortActuals = maxActuals - actualWeightArray[i];
        var shortCharged = maxCharged - chargedWeightArray[i];
        //shortage reported
        var shortageReported = {
          lrNumber: lrArray[i],
          qty: shortNOP,
          actualWeight: shortActuals,
          chargedWeight: shortCharged,
        };

        lrID.materialStatus.dispatched.qty -= parseInt(shortNOP);
        lrID.materialStatus.dispatched.actualWeight -= parseFloat(shortActuals);
        lrID.materialStatus.dispatched.chargedWeight -= parseFloat(shortCharged);

        lrID.materialStatus.pending.qty += shortNOP;
        lrID.materialStatus.pending.actualWeight += shortActuals;
        lrID.materialStatus.pending.chargedWeight += shortCharged;

        await lrID.save();

        challanDATA.shortageReported.push(shortageReported);
        await challanDATA.save();

        //getting update on shortage from booking godown
        const updateGodown = await godown.findById(challanDATA.from).session(session)
        const newObject = {
          LR: lrID.id,
          challan: challanNumber,
          active: true
        }

        updateGodown.shortage.push(newObject)
        await updateGodown.save()

      }

      //updating status in LR 
      // removing recieved material fromm dispatched
      lrID.materialStatus.dispatched.qty -= NOPArray[i];
      lrID.materialStatus.dispatched.actualWeight -= parseFloat(actualWeightArray[i]);
      lrID.materialStatus.dispatched.chargedWeight -= parseFloat(chargedWeightArray[i]);

      if (lrID.bookingGodown.toString() === req.user.godown.id) {
        //when material is receievd at booking godown itself
        lrID.materialStatus.atBookingGodown.qty += parseInt(NOPArray[i]);
        lrID.materialStatus.atBookingGodown.actualWeight += parseFloat(actualWeightArray[i]);
        lrID.materialStatus.atBookingGodown.chargedWeight += parseFloat(chargedWeightArray[i]);

      } else if (materialForArray[i] === "delivery") {
        //wehn lr is not at booking godown and arrival godown recieves it for delivery purpose
        lrID.materialStatus.deliveryGodown.qty += parseInt(NOPArray[i]);
        lrID.materialStatus.deliveryGodown.chargedWeight += parseFloat(chargedWeightArray[i]);
        lrID.materialStatus.deliveryGodown.actualWeight += parseFloat(actualWeightArray[i]);
      } else {
        //wehn lr is not at booking godown and arrival godown recieves it for transfer purpose
        lrID.materialStatus.transfer.qty += parseInt(NOPArray[i]);
        lrID.materialStatus.transfer.chargedWeight += parseFloat(chargedWeightArray[i]);
        lrID.materialStatus.transfer.actualWeight += parseFloat(actualWeightArray[i]);
      }



      await lrID.save();
      let transfer = false
      if (materialForArray[i] === "transfer") {
        transfer = true
      }
      const tempMaterial = {
        lrNumber: lrArray[i],
        qty: NOPArray[i],
        actualWeight: actualWeightArray[i],
        chargedWeight: chargedWeightArray[i],
        transfer: transfer
      };
      material.push(tempMaterial);

    }

    //saving lorry arrival first so later can be updated in stock details

    const newArrivalNumber = await updatePrintNumber(db, session, req.user, "laCALC", arrivalNumberNew)


    // we create arrival so we need to come out of loop here.
    const newLorryArrival = new la({
      number: newArrivalNumber,
      date: arrivalDate,
      challanNumber: challanNumber,
      vehicle: vehicleID,
      material: material,
      createdBy: req.user.id,
      createdAtBranch: req.user.branch.id,
      createdAtGodown: req.user.godown.id,
      financialYear : req.user.financialYear
    });

    const savedLA = await newLorryArrival.save();

    //updating LA in lr, branch, users, challans
    for (const lrDATA of lrArray) {
      await lr.findByIdAndUpdate(lrDATA, { $push: { lorryArrivals: savedLA.id } }).session(session)
    }

    //new loop to update stock in godown
    for (i = 0; i < lrArray.length; i++) {
      let transfer = false
      if (materialForArray[i] === "transfer") {
        transfer = true
      }
      //updating stock in branch
      const updateDATA = await godown.findById(req.user.godown.id).session(session)

      // Check if updateDATA has the "stock" property, or if it's empty
      if (!updateDATA.stock || updateDATA.stock.length === 0) {

        const newObject = {
          lrNumber: lrArray[i],
          qty: parseInt(NOPArray[i]),
          actualWeight: parseFloat(actualWeightArray[i]),
          chargedWeight: parseFloat(chargedWeightArray[i]),
          transfer: transfer,
        };

        // Create a new "stock" array and add the newObject to it
        updateDATA.stock.push(newObject)
      } else {
        // Iterate through existing stock items to find a match by lrNumber
        let found = false;
        for (const stock of updateDATA.stock) {
          if (stock.lrNumber.toString() === lrArray[i].toString()) {
            // Update the existing stock item

            stock.qty = stock.qty + parseInt(NOPArray[i]);
            stock.actualWeight = stock.actualWeight + parseFloat(actualWeightArray[i]);
            stock.chargedWeight = stock.chargedWeight + parseFloat(chargedWeightArray[i]);
            found = true;
            break; // Exit the loop once a match is found
          }
        }

        // If no match was found, create a new stock item
        if (!found) {

          const newObject = {
            lrNumber: lrArray[i],
            qty: parseInt(NOPArray[i]),
            actualWeight: parseFloat(actualWeightArray[i]),
            chargedWeight: parseFloat(chargedWeightArray[i]),
            transfer: transfer,
          };

          updateDATA.stock.push(newObject);
        }
      }


      // Save the updated updateDATA object
      await updateDATA.save();
    }


    for (const lrDATA of lrArray) {
      lr.findByIdAndUpdate(lrDATA, { $push: { lorryArrivals: savedLA.id } }).session(session)
    }

    const updateBranch = branch.findByIdAndUpdate(req.user.branch.id, { $push: { lorryArrival: savedLA.id } }).session(session)
    const updateGodown = godown.findByIdAndUpdate(req.user.godown.id, { $push: { lorryArrival: savedLA.id } }).session(session)
    const updateUser = users.findByIdAndUpdate(req.user.id, { $push: { lorryArrivals: savedLA.id } }).session(session)



    // Use Promise.all to wait for all three update operations to complete
    await Promise.all([updateBranch, updateUser, updateGodown]);
    const updateChallan = await challan.findById(challanNumber).session(session)

    //updating individual material of challan
    const okDATA = updateChallan.material.filter((element) => element.handlingBranch.toString() === req.user.branch.id.toString())
    for (const id of okDATA) {
      id.recieved = true
    }


    if (updateChallan.for === "branch") {
      updateChallan.active = false
    } else {
      const checkFilter = updateChallan.material.filter((element) => element.recieved === false)
      if (!checkFilter || checkFilter.length < 1) {
        updateChallan.active = false
      }
    }
    updateChallan.lorryArrival = savedLA.id

    await updateChallan.save()
    // Send a status of 200 after all updates are completed
    await session.commitTransaction()
    res.sendStatus(200);


  } catch (err) {
    await session.abortTransaction()
    console.error("An error occurred:", err);
    return res.sendStatus(500);
  } finally {
    session.endSession()
  }
});


Route.get("/transactions/delivery/lorry-arrival/get-arrival-details", async (req, res) => {
  const db = req.dbConnection
  const la = db.model("lorry-arrivals", laSchema)
  const challans = db.model("challans", challanSchema)
  const vehicles = db.model("vehicles", vehicleSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const laDATA = await la.findById(req.query.id).populate("challanNumber").populate("vehicle").populate("material.lrNumber")
  const challanDATA = await challans.findById(laDATA.challanNumber.id)
  if (laDATA && challanDATA) {
    return res.status(200).send({ laDATA, challanDATA })
  } else {
    return res.status(400).send({ message: "NO DATA FOUND" })
  }
})




Route.post("/transactions/delivery/lorry-arrival/update", async (req, res) => {
  const db = req.dbConnection
  const la = db.model("lorry-arrivals", laSchema)
  const challan = db.model("challans", challanSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const godown = db.model("godowns", godownSchema)
  const session = await db.startSession()
  const {
    arrivalDate,
    challanNumber,
    vehicleID,
    vehicleNumber,
    lrNumber,
    actualWeight,
    chargedWeight,
    materialFor,
    NOP,
  } = req.body;
  const lrArray = Array.isArray(lrNumber) ? lrNumber : [lrNumber];
  const chargedWeightArray = Array.isArray(chargedWeight) ? chargedWeight : [chargedWeight];
  const actualWeightArray = Array.isArray(actualWeight) ? actualWeight : [actualWeight];
  const materialForArray = Array.isArray(materialFor) ? materialFor : [materialFor];
  const NOPArray = Array.isArray(NOP) ? NOP : [NOP];
  const NOPSum = NOPArray.reduce((acc, qty) => acc + parseInt(qty, 10), 0);

  try {
    session.startTransaction()
    if (NOPSum < 1 || !lrArray || !chargedWeight || !actualWeightArray || !materialForArray) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Please Receive at least 1 Package" });
    }
    // making sure that we dont recieve more materialn than sent in Challan
    const challanDATA = await challan.findById(challanNumber).session(session)

    for (i = 0; i < lrArray.length; i++) {
      const lrID = await lr.findById(lrArray[i]).session(session)
      const filteredChallanData = await challanDATA.material.find((element) => element.lrNumber.toString() === lrArray[i].toString());
      let maxNOP = filteredChallanData.qty
      let maxActuals = filteredChallanData.actualWeight
      let maxCharged = filteredChallanData.chargedWeight

      const found = challanDATA.materialFound.find((element) => element.lrNumber.toString() === lrArray[i].toString());
      if (found) {
        maxNOP -= found.qty
        maxActuals -= found.actualWeight
        maxCharged -= found.chargedWeight
      }

      if (maxNOP < parseInt(NOPArray[i])) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Recieved QTY Cannot Be Greater than Dispatched in LR Number: " + lrID.lrNumber });
      } else if (maxActuals < parseInt(actualWeightArray[i])) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Actual Weight Cannot Be Greater than Dispatched in LR Number: " + lrID.lrNumber });
      } else if (maxCharged < parseInt(chargedWeightArray[i])) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Charged Weight Cannot Be Greater than Dispatched in LR Number: " + lrID.lrNumber });
      } else if (maxNOP > parseInt(NOPArray[i]) && (maxCharged === parseInt(chargedWeightArray[i]) || maxActuals === parseInt(actualWeightArray[i]))) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Charged Weight & Actual Weight Cannot be recieved 100% if 100% of packages are not recieved " + lrID.lrNumber });
      } else if (maxNOP == parseInt(NOPArray[i]) && (maxCharged !== parseInt(chargedWeightArray[i]) || maxActuals !== parseInt(actualWeightArray[i]))) {
        await session.abortTransaction()
        return res.status(400).send({ message: "Charged Weight & Actual Weight Should be 100% Since 100% of the packages are recieved " + lrID.lrNumber });
      }

    }



    //now we have to check if user is trying to remove packages, then removed packages stock should be at godown, not out for delivery or dispatched
    for (i = 0; i < NOPArray.length; i++) {
      //calculating available stock at godown

      const found = req.user.godown.stock.find(element => element.lrNumber.toString() === lrArray[i].toString())
      let NOPAvailable = 0
      let ActualsAvailable = 0
      let ChargedAvailable = 0
      if(found) {
         NOPAvailable = found.qty
         ActualsAvailable = found.actualWeight
         ChargedAvailable = found.chargedWeight
      }

      //calculating difference in current Arrival Data & Previous Available Data
      const laDATA = await la.findOne({ challanNumber: challanNumber }).session(session)
      const lrDATA = await lr.findById(lrArray[i]).session(session)
      const filtered = await laDATA.material.find(element => element.lrNumber.toString() === lrArray[i].toString())
      const diffNOP = filtered.qty - parseInt(NOPArray[i])
      const diffCharged = filtered.chargedWeight - parseInt(chargedWeightArray[i])
      const diffActuals = filtered.actualWeight - parseInt(actualWeightArray[i])

      //now we will check that only upto max available stock is removed

      if (NOPAvailable < diffNOP) {

        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Remove More Packages Than Available From Arrival in LR Number: ${lrDATA.lrNumber}` })
      } else if (ActualsAvailable < diffActuals) {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Remove More Actual Weight Than Available From Arrival in LR Number: ${lrDATA.lrNumber}` })
      } else if (ChargedAvailable < diffCharged) {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Remove More Charged Weight Than Available From Arrival in LR Number: ${lrDATA.lrNumber}` })
      }

    }


    //now we will chekc if material was previously receievd at same godown for delivery or transfer, and its status is not changed while recieving new arrival
    for (i = 0; i < lrArray.length; i++) {
      const lrDATA = await lr.findById(lrArray[i]).session(session)
      const laDATA = await la.findOne({ challanNumber: challanNumber }).session(session)
      const filteredLA = laDATA.material.find(element => element.lrNumber.toString() === lrArray[i])
      const godownDATA = await godown.findById(req.user.godown.id).session(session)
      const filtered = godownDATA.stock.find(element => element.lrNumber.toString() === lrArray[i].toString())
      if (filtered && filtered.transfer === false && materialForArray[i] === "transfer" && filtered.qty !== filteredLA.qty) {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Recieve Material for Transfer Since It Was Previously Receieved for Delivery in LR Number: ${lrDATA.lrNumber}` })
      } else if (filtered && filtered.transfer === true && materialForArray[i] === "delivery" && filtered.qty !== filteredLA.qty) {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Recieve Material for Delivery Since It Was Previously Receieved for Transfer in LR Number: ${lrDATA.lrNumber}` })
      }

    }




    //now since all validations done,  we reverse all lorry arrivals we did previously
    for (i = 0; i < NOPArray.length; i++) {
      const laDATA = await la.findOne({ challanNumber: challanNumber }).session(session)
      const lrDATA = await lr.findById(lrArray[i]).session(session)
      const filteredChallan = challanDATA.material.find(element => element.lrNumber.toString() === lrArray[i])
      const filteredLA = laDATA.material.find(element => element.lrNumber.toString() === lrArray[i])

      //shortage
      if (filteredChallan.qty !== filteredLA.qty) {
        // now we calculate shortage that was declared previously in lr since we have to reverse that first
        const found = challanDATA.materialFound.find((element) => element.lrNumber.toString() === lrArray[i].toString());
        const pending = challanDATA.shortageReported.find((element) => element.lrNumber.toString() === lrArray[i].toString());
        let shortNOP = filteredChallan.qty - filteredLA.qty
        let shortActuals = filteredChallan.actualWeight - filteredLA.actualWeight
        let shortCharged = filteredChallan.chargedWeight - filteredLA.chargedWeight
        if (found) {
          shortNOP -= found.qty
          shortActuals -= found.actualWeight
          shortCharged -= found.chargedWeight
        }

        //.first we add all material back to dispatched
        lrDATA.materialStatus.dispatched.qty += filteredLA.qty
        lrDATA.materialStatus.dispatched.actualWeight += filteredLA.actualWeight
        lrDATA.materialStatus.dispatched.chargedWeight += filteredLA.chargedWeight

        if (pending) {
          //.first we add all material back to dispatched
          lrDATA.materialStatus.dispatched.qty += pending.qty
          lrDATA.materialStatus.dispatched.actualWeight += pending.actualWeight
          lrDATA.materialStatus.dispatched.chargedWeight += pending.chargedWeight
        }

        // now we remove previously declared shortage from pending

        lrDATA.materialStatus.pending.qty -= shortNOP
        lrDATA.materialStatus.pending.actualWeight -= shortActuals
        lrDATA.materialStatus.pending.chargedWeight -= shortCharged

        //now we remove material that was recieved previously in la from delivery / transfer based on previous user input'

        if (filteredLA.transfer === false) {
          //we remove it from delivery
          lrDATA.materialStatus.deliveryGodown.qty -= filteredLA.qty
          lrDATA.materialStatus.deliveryGodown.actualWeight -= filteredLA.actualWeight
          lrDATA.materialStatus.deliveryGodown.chargedWeight -= filteredLA.chargedWeight
        } else {
          //we remove from transfer if in case material was recieved for transfer
          lrDATA.materialStatus.transfer.qty -= filteredLA.qty
          lrDATA.materialStatus.transfer.actualWeight -= filteredLA.actualWeight
          lrDATA.materialStatus.transfer.chargedWeight -= filteredLA.chargedWeight
        }

        //we pull all shortage from lorry arrival
        laDATA.shortage = []
        // now we pull shortage from booking godown
        const godownDATA = await godown.findById(challanDATA.from).session(session)
        const filtered = godownDATA.shortage.find(element => element.challan.toString() === challanNumber)
        godownDATA.shortage.pull(filtered)
        await godownDATA.save()

        await laDATA.save()
        await lrDATA.save()
        //no shortage
      } else {

        //first we add material back dispatched status to rerverse
        lrDATA.materialStatus.dispatched.qty += filteredLA.qty
        lrDATA.materialStatus.dispatched.actualWeight += filteredLA.actualWeight
        lrDATA.materialStatus.dispatched.chargedWeight += filteredLA.chargedWeight
        if (filteredLA.transfer === false) {

          //we remove it from delivery

          lrDATA.materialStatus.deliveryGodown.qty -= filteredLA.qty
          lrDATA.materialStatus.deliveryGodown.actualWeight -= filteredLA.actualWeight
          lrDATA.materialStatus.deliveryGodown.chargedWeight -= filteredLA.chargedWeight
        } else {

          //we remove from transfer if in case material was recieved for transfer
          lrDATA.materialStatus.transfer.qty -= filteredLA.qty
          lrDATA.materialStatus.transfer.actualWeight -= filteredLA.actualWeight
          lrDATA.materialStatus.transfer.chargedWeight -= filteredLA.chargedWeight
        }

        await laDATA.save()
        await lrDATA.save()

      }

      // now to godown stock we have to calculate change in stock: there can be 2 cases - increase or decrease, if its same we dont need to do anything
      const godownDATA = await godown.findById(req.user.godown.id).session()
      let transfer = false
      if (materialForArray[i] === "transfer") {
        transfer = true
      }

      //updating transfer status in material stock at godown

      const transferUpdate = godownDATA.stock.find(element => element.lrNumber.toString() === lrArray[i].toString())
     if(transferUpdate) {
      transferUpdate.transfer = transfer
      await godownDATA.save()
     }
      


      //reduction in quantity
      if (filteredLA.qty > parseInt(NOPArray[i])) {
        //implies that qty recieved while updating so we need to reduce stock at godown
        const reduction = filteredLA.qty - parseInt(NOPArray[i])
        const filtered = godownDATA.stock.find(element => element.qty > 0 && element.lrNumber.toString() === lrArray[i].toString() && element.transfer === transfer)
        filtered.qty -= reduction
        await godownDATA.save()
      }

      //increase in quantity
      if (filteredLA.qty < parseInt(NOPArray[i])) {
        //implies that qty recieved while updating so we need to reduce stock at godown
        const increase = parseInt(NOPArray[i]) - filteredLA.qty
        const filtered = godownDATA.stock.find(element => element.qty >= 0 && element.lrNumber.toString() === lrArray[i].toString() && element.transfer === transfer)
        filtered.qty += increase
        await godownDATA.save()
      }


      //reduction in actual weight
      if (filteredLA.actualWeight > parseInt(actualWeightArray[i])) {
        //implies that qty recieved while updating so we need to reduce stock at godown
        const reduction = filteredLA.actualWeight - parseInt(actualWeightArray[i])
        const filtered = godownDATA.stock.find(element => element.actualWeight > 0 && element.lrNumber.toString() === lrArray[i].toString() && element.transfer === transfer)
        filtered.actualWeight -= reduction
        await godownDATA.save()
      }

      //increase in actual weight
      if (filteredLA.actualWeight < parseInt(actualWeightArray[i])) {
        //implies that qty recieved while updating so we need to reduce stock at godown
        const increase = parseInt(actualWeightArray[i]) - filteredLA.actualWeight
        const filtered = godownDATA.stock.find(element => element.actualWeight >= 0 && element.lrNumber.toString() === lrArray[i].toString() && element.transfer === transfer)
        filtered.actualWeight += increase
        await godownDATA.save()
      }

      //reduction in charged weight
      if (filteredLA.chargedWeight > parseInt(chargedWeightArray[i])) {
        //implies that qty recieved while updating so we need to reduce stock at godown
        const reduction = filteredLA.chargedWeight - parseInt(chargedWeightArray[i])
        const filtered = godownDATA.stock.find(element => element.chargedWeight > 0 && element.lrNumber.toString() === lrArray[i].toString() && element.transfer === transfer)
        filtered.chargedWeight -= reduction
        await godownDATA.save()
      }

      //increase in charged weight
      if (filteredLA.chargedWeight < parseInt(chargedWeightArray[i])) {
        //implies that qty recieved while updating so we need to reduce stock at godown
        const increase = parseInt(chargedWeightArray[i]) - filteredLA.chargedWeight
        const filtered = godownDATA.stock.find(element => element.chargedWeight >= 0 && element.lrNumber.toString() === lrArray[i].toString() && element.transfer === transfer)
        filtered.chargedWeight += increase
        await godownDATA.save()
      }


      if (i - 1 === lrArray.length) {
        laDATA.material = []
        await laDATA.save()
      }
      challanDATA.shortageReported = []
      await challanDATA.save()


    }




    const material = []
    //now since we have reversed all stock related transactions from lorry arriavl
    for (i = 0; i < lrArray.length; i++) {
      const lrID = await lr.findById(lrArray[i]).session(session)
      const filteredChallanData = await challanDATA.material.find((element) => element.lrNumber.toString() === lrArray[i].toString());
      //checking for shortwage if yes we update it in lr if no we still update lr status
      if (filteredChallanData.qty > NOPArray[i]) {
        //shortage calculation
        let shortNOP = filteredChallanData.qty - NOPArray[i];
        let shortActuals = filteredChallanData.actualWeight - actualWeightArray[i];
        let shortCharged = filteredChallanData.chargedWeight - chargedWeightArray[i];

        const found = challanDATA.materialFound.find((element) => element.lrNumber.toString() === lrArray[i].toString());


        if (found) {
          shortNOP -= found.qty
          shortActuals -= found.actualWeight
          shortCharged -= found.chargedWeight
        }

        if (shortNOP > 0) {
          //shortage reported
          var shortageReported = {
            lrNumber: lrArray[i],
            qty: shortNOP,
            actualWeight: shortActuals,
            chargedWeight: shortCharged,
          };



          lrID.materialStatus.dispatched.qty -= parseInt(shortNOP);
          lrID.materialStatus.dispatched.actualWeight -= parseFloat(shortActuals);
          lrID.materialStatus.dispatched.chargedWeight -= parseFloat(shortCharged);

          lrID.materialStatus.pending.qty += shortNOP;
          lrID.materialStatus.pending.actualWeight += shortActuals;
          lrID.materialStatus.pending.chargedWeight += shortCharged;

          await lrID.save();

          challanDATA.shortageReported.push(shortageReported);
          await challanDATA.save();

          //getting update on shortage from booking godown
          const updateGodown = await godown.findById(challanDATA.from).session(session)
          const newObject = {
            LR: lrID.id,
            challan: challanNumber,
            active: true
          }

          updateGodown.shortage.push(newObject)
          await updateGodown.save()
        }

      }
      //updating status in LR 
      // removing recieved material fromm dispatched
      lrID.materialStatus.dispatched.qty -= NOPArray[i];
      lrID.materialStatus.dispatched.actualWeight -= parseFloat(actualWeightArray[i]);
      lrID.materialStatus.dispatched.chargedWeight -= parseFloat(chargedWeightArray[i]);

      if (lrID.bookingGodown.toString() === req.user.godown.id) {
        //when material is receievd at booking godown itself
        lrID.materialStatus.atBookingGodown.qty += parseInt(NOPArray[i]);
        lrID.materialStatus.atBookingGodown.actualWeight += parseFloat(actualWeightArray[i]);
        lrID.materialStatus.atBookingGodown.chargedWeight += parseFloat(chargedWeightArray[i]);
        await lrID.save()
      } else if (materialForArray[i] === "delivery") {
        //wehn lr is not at booking godown and arrival godown recieves it for delivery purpose
        lrID.materialStatus.deliveryGodown.qty += parseInt(NOPArray[i]);
        lrID.materialStatus.deliveryGodown.chargedWeight += parseFloat(chargedWeightArray[i]);
        lrID.materialStatus.deliveryGodown.actualWeight += parseFloat(actualWeightArray[i]);

        await lrID.save()
      } else {
        //wehn lr is not at booking godown and arrival godown recieves it for transfer purpose
        lrID.materialStatus.transfer.qty += parseInt(NOPArray[i]);
        lrID.materialStatus.transfer.chargedWeight += parseFloat(chargedWeightArray[i]);
        lrID.materialStatus.transfer.actualWeight += parseFloat(actualWeightArray[i]);

        await lrID.save()
      }



      await lrID.save();
      let transfer = false
      if (materialForArray[i] === "transfer") {
        transfer = true
      }
      const tempMaterial = {
        lrNumber: lrArray[i],
        qty: NOPArray[i],
        actualWeight: actualWeightArray[i],
        chargedWeight: chargedWeightArray[i],
        transfer: transfer
      };
      material.push(tempMaterial);

    }

    const laDATA = await la.findOne({ challanNumber: challanNumber }).session(session)
    laDATA.material = material
    await laDATA.save()

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

Route.get("/transactions/booking/lorry-arrival/delete", async (req, res) => {
  const db = req.dbConnection
  const la = db.model("lorry-arrivals", laSchema)
  const challan = db.model("challans", challanSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const godown = db.model("godowns", godownSchema)
  const session = await db.startSession()
  try {
    session.startTransaction()
    // before deleting lorry arrival we need to make sure we have sufficent stock at godown which we recieved 
    const laDATA = await la.findById(req.query.id).session(session)
    const challanDATA = await challan.findById(laDATA.challanNumber).session(session)
    const godownDATA = await godown.findById(req.user.godown.id).session(session)
    for (const material of laDATA.material) {
      const filtered = godownDATA.stock.find(element => element.lrNumber.toString() === material.lrNumber.toString())
      if(!filtered) {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Delete Lorry Arrival Since You Dont Have Enough Stock` })
      } else if (filtered.qty < material.qty) {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Delete Lorry Arrival Since You Dont Have Enough Stock` })
      } else if (filtered.actualWeight < material.actualWeight) {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Delete Lorry Arrival Since You Dont Have Enough Stock` })
      } else if (filtered.chargedWeight < material.chargedWeight) {
        await session.abortTransaction()
        return res.status(400).send({ message: `You Cannot Delete Lorry Arrival Since You Dont Have Enough Stock` })
      }
    }

    // now since we have verified that we have sufficent stock in godown we can delete lorry arrival
    for (const material of laDATA.material) {
      const filtered = godownDATA.stock.find(element => element.lrNumber.toString() === material.lrNumber.toString())
      filtered.qty -= material.qty
      filtered.actualWeight -= material.actualWeight
      filtered.chargedWeight -= material.chargedWeight

      if(filtered.qty === 0){
        godownDATA.stock.pull(filtered)
      }
      await godownDATA.save()
    }
    // we need to update lr status as well
    for (const material of laDATA.material) {
      const lrDATA = await lr.findById(material.lrNumber).session(session)
      lrDATA.materialStatus.dispatched.qty += material.qty
      lrDATA.materialStatus.dispatched.actualWeight += material.actualWeight
      lrDATA.materialStatus.dispatched.chargedWeight += material.chargedWeight

      if (lrDATA.bookingGodown.toString() === req.user.godown.id) {
        lrDATA.materialStatus.atBookingGodown.qty -= material.qty
        lrDATA.materialStatus.atBookingGodown.actualWeight -= material.actualWeight
        lrDATA.materialStatus.atBookingGodown.chargedWeight -= material.chargedWeight
      } else if (material.transfer === false) {
        lrDATA.materialStatus.deliveryGodown.qty -= material.qty
        lrDATA.materialStatus.deliveryGodown.actualWeight -= material.actualWeight
        lrDATA.materialStatus.deliveryGodown.chargedWeight -= material.chargedWeight
      } else {
        lrDATA.materialStatus.transfer.qty -= material.qty
        lrDATA.materialStatus.transfer.actualWeight -= material.actualWeight
        lrDATA.materialStatus.transfer.chargedWeight -= material.chargedWeight
      }


      lrDATA.lorryArrivals.pull(laDATA.id)
      await lrDATA.save()
    }

    // now we need to check if shortage was created in challan if yes we need to reverse that as well and update status is lr, also we need to check if material was found so we need to adjust that as well
    for (const material of laDATA.material) {
      const challanDATA = await challan.findById(laDATA.challanNumber).session(session)
      const filtered = challanDATA.material.find(element => element.lrNumber.toString() === material.lrNumber.toString())
      if (filtered.qty !== material.qty) {
        //shortage was created
        const found = challanDATA.materialFound.find(element => element.lrNumber.toString() === material.lrNumber.toString())
        const pending = challanDATA.shortageReported.find(element => element.lrNumber.toString() === material.lrNumber.toString())
        let shortNOP = filtered.qty - material.qty
        let shortActuals = filtered.actualWeight - material.actualWeight
        let shortCharged = filtered.chargedWeight - material.chargedWeight
        if (found) {
          shortNOP -= found.qty
          shortActuals -= found.actualWeight
          shortCharged -= found.chargedWeight
        }
        //now we need to add shortage back to dispatched
        const lrDATA = await lr.findById(material.lrNumber).session(session)
        lrDATA.materialStatus.dispatched.qty += shortNOP
        lrDATA.materialStatus.dispatched.actualWeight += shortActuals
        lrDATA.materialStatus.dispatched.chargedWeight += shortCharged
        //now we need to remove shortage from pending
        lrDATA.materialStatus.pending.qty -= shortNOP
        lrDATA.materialStatus.pending.actualWeight -= shortActuals
        lrDATA.materialStatus.pending.chargedWeight -= shortCharged
        await lrDATA.save()
        //now we need to remove shortage from challan
        challanDATA.shortageReported.pull(pending)

        await challanDATA.save()

      }

    }



    // now we need to set lorryArrival fiedl in challan as null
    challanDATA.lorryArrival = null
    challanDATA.active = true
    await challanDATA.save()

    // now we need to remove lorry arrival from godown
    godownDATA.lorryArrivals.pull(laDATA.id)
    await godownDATA.save()

    // now since we have removed lorry arrival from godown we can delete lorry arrival
    await la.findByIdAndDelete(req.query.id).session(session)
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
module.exports = Route;
