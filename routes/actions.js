const express = require("express")
const Route = express.Router()
const lrSchema = require("../models/transactions/bookings/lorry-reciept")
const challanSchema = require("../models/transactions/bookings/challan")
const godownSchema = require("../models/masters/locations/godowns")
const laSchema = require("../models/transactions/delivery/lorry-arrival")

Route.get("/actions", async (req, res) => {
  const db = req.dbConnection
  const lr = db.model("lorry-reciepts", lrSchema)
  const challan = db.model("challans", challanSchema)
  const godown = db.model("godowns", godownSchema)
  const la = db.model("lorry-arrivals", laSchema)
  var constructedData = []
  for (const data of req.user.godown.shortage) {

    const challanData = await challan.findById(data.challan).populate("shortageReported.lrNumber").populate("lorryArrival")
    if (challanData) {
      const filteredChallanData = challanData.shortageReported.find((element) => element.lrNumber.id.toString() === data.LR.toString())
      if (filteredChallanData) {
        const newData = {
          lrID: filteredChallanData.lrNumber.id,
          lrNumber: filteredChallanData.lrNumber.lrNumber,
          challanNumber: challanData.number,
          challanID: challanData.id,
          lorryArrivalID: challanData.lorryArrival._id,
          lorryArrivalNumber: challanData.lorryArrival.number,
          NOPLost: filteredChallanData.qty,
          consignor: filteredChallanData.lrNumber.consignorName,
          consignee: filteredChallanData.lrNumber.consigneeName,
          actualWeight: filteredChallanData.actualWeight,
          chargedWeight: filteredChallanData.chargedWeight

        }

        constructedData.push(newData)
      }
    }
  }


  // Only For Demo
  const inventoryData = []
  const inventoryReport = await lr.find({ bookingGodown: req.user.godown.id }).populate("challans")
  for (const lrDATA of inventoryReport) {




    var data = {
      lrNumber: lrDATA.lrNumber,
      //for booking
      actualWeightAtBooking: lrDATA.materialStatus.atBookingGodown.actualWeight,
      chargedWeightAtBooking: lrDATA.materialStatus.atBookingGodown.chargedWeight,
      qtyAtBooking: lrDATA.materialStatus.atBookingGodown.qty,
      //for dispatched
      actualWeightDispatched: lrDATA.materialStatus.dispatched.actualWeight,
      chargedWeightDispatched: lrDATA.materialStatus.dispatched.chargedWeight,
      qtyDispatched: lrDATA.materialStatus.dispatched.qty,
      //for transfer
      actualWeightTransfer: lrDATA.materialStatus.transfer.actualWeight,
      chargedWeightTransfer: lrDATA.materialStatus.transfer.chargedWeight,
      qtyTransfer: lrDATA.materialStatus.transfer.qty,
      //for delivery godown
      actualWeightDeliveryGodown: lrDATA.materialStatus.deliveryGodown.actualWeight,
      chargedWeightDeliveryGodown: lrDATA.materialStatus.deliveryGodown.chargedWeight,
      qtyDeliveryGodown: lrDATA.materialStatus.deliveryGodown.qty,
      // for pending
      actualWeightPending: lrDATA.materialStatus.pending.actualWeight,
      chargedWeightPending: lrDATA.materialStatus.pending.chargedWeight,
      qtyPending: lrDATA.materialStatus.pending.qty,
      //for out for delivery
      actualWeightOutForDelivery: lrDATA.materialStatus.outForDelivery.actualWeight,
      chargedWeightOutForDelivery: lrDATA.materialStatus.outForDelivery.chargedWeight,
      qtyOutForDelivery: lrDATA.materialStatus.outForDelivery.qty,
      //for delivered
      actualWeightDelivered: lrDATA.materialStatus.delivered.actualWeight,
      chargedWeightDelivered: lrDATA.materialStatus.delivered.chargedWeight,
      qtyDelivered: lrDATA.materialStatus.delivered.qty,
    }
    inventoryData.push(data)

  }



  res.render("actions", { data: constructedData, inventoryData: inventoryData })


})



Route.post("/actions", async (req, res) => {
  const db = req.dbConnection
  const lr = db.model("lorry-reciepts", lrSchema)
  const challan = db.model("challans", challanSchema)
  const godown = db.model("godowns", godownSchema)
  const la = db.model("lorry-arrivals", laSchema)
  const session = await db.startSession()

  const { actionType, lrNumber, challanNumber, actualWeight, chargedWeight, NOPFound } = req.body;

  try {


    session.startTransaction()
    const lrData = await lr.findById(lrNumber).session(session)


    const challanData = await challan.findById(challanNumber).session()
    const shortageFound = challanData.shortageReported.find((element) => element.lrNumber.toString() === lrNumber.toString());
    const maxNOP = shortageFound.qty;
    const maxActualWeight = shortageFound.actualWeight;
    const maxChargedWeight = shortageFound.chargedWeight;

    if ((maxNOP === parseInt(NOPFound)) && (parseFloat(maxActualWeight) !== parseFloat(actualWeight) || parseFloat(maxChargedWeight) !== parseFloat(chargedWeight))) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Actual Weight & Charged Weight Cannot Be Left In Balance When All Packages Are Found" });
    } else if ((parseFloat(maxActualWeight) === parseFloat(actualWeight) || parseFloat(maxChargedWeight) === parseFloat(chargedWeight)) && (maxNOP !== parseInt(NOPFound))) {
      await session.abortTransaction()
      return res.status(400).send({ message: "Actual Weight & Charged Weight Cannot be found 100% When All Packages are not found" });
    }


    // all form validations done
    //removing material found from pending status in lr
    lrData.materialStatus.pending.qty -= parseInt(NOPFound);
    lrData.materialStatus.pending.actualWeight -= parseFloat(actualWeight);
    lrData.materialStatus.pending.chargedWeight -= parseFloat(chargedWeight);
    await lrData.save();

    //adding back to booking godown if material found at booking godown
    if (req.user.godown.id.toString() === lrData.bookingGodown.toString()) {
      lrData.materialStatus.atBookingGodown.qty += parseInt(NOPFound);
      lrData.materialStatus.atBookingGodown.actualWeight += parseFloat(actualWeight);
      lrData.materialStatus.atBookingGodown.chargedWeight += parseFloat(chargedWeight);
      await lrData.save();
    } else {
      //adding back to transfer material not found at booking godown
      lrData.materialStatus.transfer.qty += parseInt(NOPFound);
      lrData.materialStatus.transfer.actualWeight += parseFloat(actualWeight);
      lrData.materialStatus.transfer.chargedWeight += parseFloat(chargedWeight);
      await lrData.save();
    }

    // this implies that 100% of lost material is found

    if (shortageFound.qty === parseInt(NOPFound)) {

      const godownData = await godown.findById(req.user.godown.id).session(session)
      const filtered = godownData.shortage.find(element => element.challan.toString() === challanData.id.toString() && element.LR.toString() === lrData.id.toString())
      godownData.shortage.pull(filtered)
      await godownData.save()
      const challanToUpdate = await challan.findById(challanNumber).session(session)

      if (!challanToUpdate) {
        await session.abortTransaction()
        return res.status(400).send("Challan not found");
      }

      const elementToUpdate = challanToUpdate.shortageReported.find((element) => element.lrNumber.toString() === lrNumber.toString());

      if (!elementToUpdate) {
        await session.abortTransaction()
        return res.status(400).send("Element not found");
      }

      const isUpdateValid = (parseInt(NOPFound) <= elementToUpdate.qty && parseFloat(actualWeight) <= parseFloat(elementToUpdate.actualWeight) && parseFloat(chargedWeight) <= parseFloat(elementToUpdate.chargedWeight));

      if (isUpdateValid) {

        elementToUpdate.qty = 0;
        elementToUpdate.actualWeight = 0;
        elementToUpdate.chargedWeight = 0;

        const existingMaterialFound = challanToUpdate.materialFound.find((materialFound) => materialFound.lrNumber.toString() === lrNumber.toString());

        if (existingMaterialFound) {
          existingMaterialFound.qty += parseInt(NOPFound);
          existingMaterialFound.actualWeight += parseFloat(actualWeight);
          existingMaterialFound.chargedWeight += parseFloat(chargedWeight);
        } else {
          const materialFound = {
            lrNumber: lrNumber,
            qty: parseInt(NOPFound),
            actualWeight: parseFloat(actualWeight),
            chargedWeight: parseFloat(chargedWeight),
          };
          challanToUpdate.materialFound.push(materialFound);
        }

        if (lrData.bookingGodown.toString() !== req.user.godown.id.toString()) {

          const godownDATA = await godown.findById(req.user.godown.id).session(session)
          const filtered = godownDATA.stock.find(element => element.lrNumber.toString() === lrData.id.toString())
          filtered.qty += parseInt(NOPFound)
          filtered.actualWeight += parseFloat(actualWeight)
          filtered.chargedWeight += parseFloat(chargedWeight)

          await godownDATA.save()
        }

        await lrData.save();
        challanToUpdate.shortageReported.pull(elementToUpdate)
        await challanData.save()
        await challanToUpdate.save();
      } else {
        await session.abortTransaction()
        return res.status(400).send("Invalid values for NOP, actualWeight, or chargedWeight");
      }

      //only few of the short material found at action godown
    } else {

      const challanToUpdate = await challan.findById(challanNumber).session(session)

      if (!challanToUpdate) {
        await session.abortTransaction()
        return res.status(400).send("Challan not found");
      }

      const elementToUpdate = challanToUpdate.shortageReported.find((element) => element.lrNumber.toString() === lrNumber.toString());

      if (!elementToUpdate) {
        await session.abortTransaction()
        return res.status(400).send("Element not found");
      }

      const isUpdateValid = (parseInt(NOPFound) <= elementToUpdate.qty && parseFloat(actualWeight) <= parseFloat(elementToUpdate.actualWeight) && parseFloat(chargedWeight) <= parseFloat(elementToUpdate.chargedWeight));

      if (isUpdateValid) {

        elementToUpdate.qty -= NOPFound
        elementToUpdate.actualWeight -= actualWeight
        elementToUpdate.chargedWeight -= chargedWeight

        const existingMaterialFound = challanToUpdate.materialFound.find((materialFound) => materialFound.lrNumber.toString() === lrNumber.toString());

        if (existingMaterialFound) {
          existingMaterialFound.qty += parseInt(NOPFound);
          existingMaterialFound.actualWeight += parseFloat(actualWeight);
          existingMaterialFound.chargedWeight += parseFloat(chargedWeight);
        } else {
          const materialFound = {
            lrNumber: lrNumber,
            qty: parseInt(NOPFound),
            actualWeight: parseFloat(actualWeight),
            chargedWeight: parseFloat(chargedWeight),
          };
          challanToUpdate.materialFound.push(materialFound);
        }

        if (lrData.bookingGodown.toString() !== req.user.godown.id.toString()) {

          const godownDATA = await godown.findById(req.user.godown.id).session(session)
          const filtered = godownDATA.stock.find(element => element.lrNumber.toString() === lrData.id.toString())
          filtered.qty += parseInt(NOPFound)
          filtered.actualWeight += parseFloat(actualWeight)
          filtered.chargedWeight += parseFloat(chargedWeight)

          await godownDATA.save()
        }

        await lrData.save();
        await challanData.save()
        await challanToUpdate.save();
        console.log("OK")
      } else {
        await session.abortTransaction()
        return res.status(400).send("Invalid values for NOP, actualWeight, or chargedWeight");
      }
    }

    await session.commitTransaction()
    return res.sendStatus(200)


  } catch (err) {
    console.log(err)
    await session.abortTransaction()
    return res.sendStatus(500)
  } finally {
    session.endSession()
  }
});





module.exports = Route