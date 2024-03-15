const express = require('express');
const Route = express.Router();
const godownSchema = require('../../../models/masters/locations/godowns');
const laSchema = require('../../../models/transactions/delivery/lorry-arrival');
const challanSchema = require('../../../models/transactions/bookings/challan');
const excessSchema = require("../../../models/transactions/delivery/excess")
const lrSchema = require("../../../models/transactions/bookings/lorry-reciept")
Route.get("/transactions/delivery/excess", async (req, res) => {
  const db = req.dbConnection
  const excess = db.model("excess", excessSchema)
  const la = db.model("lorry-arrivals", laSchema)
  const challans = db.model("challans", challanSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const laData = await la.find({ createdAtGodown: req.user.godown.id })
  const data = await excess.find({
    $or: [
      { reportedAt: req.user.godown.id },
      { reportedBy: req.user.godown.id }
    ]
  }).populate("lr lorryArrival challan")

  res.render("transactions/delivery/excess", { data: data, laData: laData })
})

Route.get("/transactions/delivery/excess/get-arrival-detail", async (req, res) => {
  const db = req.dbConnection
  const challan = db.model("challans", challanSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const challanData = await challan.findOne({ lorryArrival: req.query.id }).populate("material.lrNumber")

  const data = []

  challanData.material.forEach(async function (item) {
    if (item.lrNumber.bookingGodown !== challanData.from) {
      // thi simplies that material there was for transfer so we we need to gets tock available from the godown
      const godown = db.model("godowns", godownSchema)
      const godownData = await godown.findById(challanData.from).populate("stock.lrNumber")
      const filtered = godownData.stock.find(item => item.lrNumber === data.lrNumber._id)
      if (filtered.qty > 0) {
        const newObject = {
          lrNumber: item.lrNumber.lrNumber,
          lrId: item.lrNumber._id,
        }
        data.push(newObject)
      }
    } else {
      if (item.lrNumber.materialStatus.atBookingGodown.qty > 0) {
        // this implies material was send from boking godown
        const newObject = {
          lrNumber: item.lrNumber.lrNumber,
          lrId: item.lrNumber._id,
        }
        data.push(newObject)
      }
    }
  })

  res.status(200).send({ challanNumber: challanData.number, lrData: data })

})

Route.get("/transactions/delivery/excess/get-lr-detail", async (req, res) => {
  const db = req.dbConnection
  const lr = db.model("lorry-reciepts", lrSchema)
  const challan = db.model("challans", challanSchema)
  const challanData = await challan.findOne({ lorryArrival: req.query.la }).populate("material.lrNumber")

  const data = challanData.material.find(item => item.lrNumber._id == req.query.id)
  if (data.lrNumber.bookingGodown !== challanData.from) {
    // thi simplies that material there was for transfer so we we need to gets tock available from the godown
    const godown = db.model("godowns", godownSchema)
    const godownData = await godown.findById(challanData.from)
    const filtered = godownData.stock.find(item => item.lrNumber === data.lrNumber._id)
    console.log(filtered)
  } else {
    // this implies material was send from boking godown
    const newObject = {
      qty: data.lrNumber.materialStatus.atBookingGodown.qty,
      actualWeight: data.lrNumber.materialStatus.atBookingGodown.actualWeight,
      chargedWeight: data.lrNumber.materialStatus.atBookingGodown.chargedWeight,

    }
    res.status(200).send(newObject)
  }

})

Route.post("/transactions/delivery/excess/new", async (req, res) => {
  const { lorryArrival, challanNumber, lr, qty, actualWeight, chargedWeight } = req.body
  const db = req.dbConnection
  const excess = db.model("excess", excessSchema)
  const la = db.model("lorry-arrivals", laSchema)
  const challan = db.model("challans", challanSchema)
  const session = await db.startSession()
  try {
    session.startTransaction()
    const challanData = await challan.findOne({ lorryArrival: req.body.lorryArrival }).populate("material.lrNumber")
    const filtered = challanData.material.find(item => item.lrNumber._id == lr)
  
    // now w e wil do form validations
    if(!lorryArrival || !challanNumber || !lr || !qty || !actualWeight || !chargedWeight){
     return res.status(400).send({message : "All fields are required"})
    }

    let maxQty = 0
    let maxActualWeight = 0
    let maxChargedWeight = 0
    if (filtered.lrNumber.bookingGodown !== challanData.from) {
      // thi simplies that material there was for transfer so we we need to gets tock available from the godown
      const godown = db.model("godowns", godownSchema)
      const godownData = await godown.findById(challanData.from).session(session)
      const filtered = godownData.stock.find(item => item.lrNumber === data.lrNumber._id)
      maxQty = filtered.qty
      maxActualWeight = filtered.actualWeight
      maxChargedWeight = filtered.chargedWeight
    } else {
      // this implies material was send from boking godown
      maxQty = filtered.lrNumber.materialStatus.atBookingGodown.qty
      maxActualWeight = filtered.lrNumber.materialStatus.atBookingGodown.actualWeight
      maxChargedWeight = filtered.lrNumber.materialStatus.atBookingGodown.chargedWeight
    }


    if(qty > maxQty){
      return res.status(400).send({message : "Quantity cannot be greater than available quantity"})
    }
    if(actualWeight > maxActualWeight){
      return res.status(400).send({message : "Actual Weight cannot be greater than available quantity"})
    }

    if(chargedWeight > maxChargedWeight){
      return res.status(400).send({message : "Charged Weight cannot be greater than available quantity"})
    }

    // now since all valid values recieved we will create new excess entry
    const excessData = new excess({
      reportedBy: req.user.godown.id,
      reportedAt: filtered.lrNumber.bookingGodown,
      lorryArrival: lorryArrival,
      challan: challanData._id,
      lr : filtered.lrNumber._id,
      qty: qty,
      actualWeight: actualWeight,
      chargedWeight: chargedWeight
    })

    await excessData.save({ session: session })
    await session.commitTransaction()
    return res.sendStatus(200)
  } catch (err) {
    await session.abortTransaction()
    console.log(err)
    res.sendStatus(500)
  } finally {
    session.endSession()
  }

})


Route.get("/transactions/delivery/excess/delete", async (req, res) => {
  const db = req.dbConnection
  const excess = db.model("excess", excessSchema)
  try {
    await excess.findByIdAndDelete(req.query.id)
    res.sendStatus(200)
  } catch (err) {
    console.log(err)
    res.sendStatus(500)
  } 
})

Route.post("/transactions/delivery/excess/action", async (req, res) => { 
  const db = req.dbConnection
  const excess = db.model("excess", excessSchema)
  const lr = db.model("lorry-reciepts", lrSchema)
  const session = await db.startSession()
  try {
    session.startTransaction()
    const {id, qty, actualWeight, chargedWeight} = req.body
    const excessData = await excess.findById(id).populate("lr challan").session(session)
    let maxQty = 0
    let maxActualWeight = 0
    let maxChargedWeight = 0


    if(!id || !qty || !actualWeight || !chargedWeight){ 
      await session.abortTransaction()
      return res.status(400).send({message : "All fields are required"})
     }

    if (excessData.lr.bookingGodown === excessData.challan.from) { 
      // thi simplies that material there was for transfer so we we need to gets tock available from the godown
      const godown = db.model("godowns", godownSchema)
      const godownData = await godown.findById(excessData.challan.from).session(session)
      const filtered = godownData.stock.find(item => item.lrNumber === excessData.lr._id)
      maxQty = filtered.qty
      maxActualWeight = filtered.actualWeight
      maxChargedWeight = filtered.chargedWeight
     } else  {
      // this implies material was send from boking godown
      maxQty = excessData.lr.materialStatus.atBookingGodown.qty
      maxActualWeight = excessData.lr.materialStatus.atBookingGodown.actualWeight
      maxChargedWeight = excessData.lr.materialStatus.atBookingGodown.chargedWeight
     
     }

     // we need to check if all values are greater than 0
      if(qty < 0 || actualWeight < 0 || chargedWeight < 0){ 
        await session.abortTransaction()
        return res.status(400).send({message : "All fields must be greater than 0"})
       }

      if(qty > maxQty){
        await session.abortTransaction()
        return res.status(400).send({message : "Quantity cannot be greater than available quantity"}) 
      } else if(actualWeight > maxActualWeight){
        await session.abortTransaction()
        return res.status(400).send({message : "Actual Weight cannot be greater than available quantity"})
      } else if(chargedWeight > maxChargedWeight){
        await session.abortTransaction() 
        return res.status(400).send({message : "Charged Weight cannot be greater than available quantity"})
       } else {

        // now since all excess values are verifed we will reduce stock from the gdoown and add it to reportedBy godown
        if (excessData.lr.bookingGodown.toString() !== excessData.challan.from.toString()) {
          // thi simplies that material there was for transfer so we we need to gets tock available from the godown
          const godown = db.model("godowns", godownSchema)
          const godownData = await godown.findById(excessData.challan.from).session(session)
          const filtered = godownData.stock.find(item => item.lrNumber == excessData.lr._id)
          filtered.qty -= parseInt(qty)
          filtered.actualWeight -= parseInt(actualWeight)
          filtered.chargedWeight -= parseInt()
          await godownData.save({ session: session })

          // now since material was at transfer godown we need to reduce it lr status transfer
          excessData.lr.materialStatus.transfer.qty -= parseInt(qty)
          excessData.lr.materialStatus.transfer.actualWeight -= parseInt(actualWeight)
          excessData.lr.materialStatus.transfer.chargedWeight -= parseInt(chargedWeight)
        } else {
          // this implies material was send from boking godown
          excessData.lr.materialStatus.atBookingGodown.qty -= parseInt(qty)
          excessData.lr.materialStatus.atBookingGodown.actualWeight -= parseInt(actualWeight)
          excessData.lr.materialStatus.atBookingGodown.chargedWeight -= parseInt(chargedWeight)
          await excessData.lr.save({ session: session })
        }

        // now we will add excess values to reportedBy godown stock or back to booking godown depending on 3 cases
        if(excessData.lr.bookingGodown === excessData.reportedBy) {
          // this implies material was send from boking godown
          excessData.lr.materialStatus.atBookingGodown.qty += parseInt(qty)
          excessData.lr.materialStatus.atBookingGodown.actualWeight +=parseInt(actualWeight)
          excessData.lr.materialStatus.atBookingGodown.chargedWeight += parseInt(chargedWeight)
          await excessData.lr.save({ session: session })
        } else {
          // now since material excess was not received at b booking godown we need to add stock to reportedBy godown
          const godown = db.model("godowns", godownSchema)
          const godownData = await godown.findById(excessData.reportedBy).session(session)
          const filtered = godownData.stock.find(item => item.lrNumber.toString() === excessData.lr.id.toString())
          filtered.qty += parseInt(qty)
          filtered.actualWeight += parseInt(actualWeight)
          filtered.chargedWeight += parseInt(chargedWeight)
          await godownData.save({ session: session })

          // now depending on filtered.transfer we will update status in lr
          if(filtered.transfer === true){
              excessData.lr.materialStatus.transfer.qty += parseInt(qty)
              excessData.lr.materialStatus.transfer.actualWeight += parseInt(actualWeight)
              excessData.lr.materialStatus.transfer.chargedWeight += parseInt(chargedWeight)
              await excessData.lr.save({ session: session })
          } else {
            excessData.lr.materialStatus.deliveryGodown.qty += parseInt(qty)
            excessData.lr.materialStatus.deliveryGodown.actualWeight += parseInt(actualWeight)
            excessData.lr.materialStatus.deliveryGodown.chargedWeight += parseInt(chargedWeight)
            await excessData.lr.save({ session: session })
          }
        }

        // now we will update excess data
        excessData.action = "completed"
        await excessData.save({ session: session })
        await session.commitTransaction()
        return res.sendStatus(200)

       }
  } catch (err) {
    await session.abortTransaction()
    console.log(err)
    res.sendStatus(500)
  } finally {
    session.endSession()
  }
 })
module.exports = Route;