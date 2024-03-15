const express = require("express")
const Route = express.Router()
const moment = require("moment")
const mongoose = require("mongoose")

const getLedgers = require("../../../custom_modules/accounts/getLedgers")

//model schema
const branchesSchema = require("../../../models/masters/locations/branch")
const ledgersSchema = require("../../../models/masters/ledgers")
const citiesSchema = require("../../../models/masters/locations/cities")
const mopSchema = require("../../../models/masters/method-of-packaging")
const goodsDescriptionSchema = require("../../../models/masters/goodsDescription")
const vehiclesSchema = require("../../../models/masters/vehicles/vehicles")
const lrSchema = require("../../../models/transactions/bookings/lorry-reciept")
const usersSchema = require("../../../models/authentication/user")
const fySchema = require("../../../models/financialYear")
const customFY = require("../../../custom_modules/customFY")
const getBillNumber = require("../../../custom_modules/getBillNumber")
const cdrSchema = require("../../../models/masters/rates/rate-master")
const roSchema = require("../../../models/masters/rates/rate-on")
const groupsSchema = require("../../../models/masters/groups")
const { getPrintNumber, updatePrintNumber } = require("../../../custom_modules/serialCalculator")
const puppeteer = require('puppeteer');
const fs = require('fs');
const ejs = require('ejs');

Route.get("/getBranchSerial", (req, res) => {
    const db = req.dbConnection
    const branches = db.model("branches", branchesSchema)

    branches.findById(req.query.id, (err, data) => {
        res.status(200).send({ serial: data.serial, lrNumber: data.lr.length + 1 })
    })
})

Route.get("/getConsignorConsignee", async (req, res) => {
    const db = req.dbConnection
    const ledgers = db.model("ledgers", ledgersSchema)
    const data = await ledgers.findById(req.query.clientID)
    res.status(200).send({ gst: data.taxation.GST, address: data.address })
})

//main lr page render
Route.get("/transactions/booking/lorry-reciepts", async (req, res) => {

    const db = req.dbConnection
    const branches = db.model("branches", branchesSchema)
    const ledgers = db.model("ledgers", ledgersSchema)
    const cities = db.model("cities", citiesSchema)
    const mop = db.model("method-of-packaging", mopSchema)
    const goodsDescription = db.model("goods-description", goodsDescriptionSchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const fy = db.model("financial-years", fySchema)
    const groups = db.model("groups", groupsSchema)
    const vehicleData = await vehicles.find({})
    const goodsDescriptionData = await goodsDescription.find({})
    const mopData = await mop.find({})
    const cityData = await cities.find({})



    const clientData = await getLedgers(db, "sundrydebtors")

    const branchData = await branches.find({})
    const lrDATA = await lr
        .find({ bookingGodown: req.user.godown.id, status: true, financialYear: req.user.financialYear })
        .sort({ _id: -1 }) // Sort by the _id field in descending order (latest first)
        .limit(500).populate("from").populate("to")

    const fyData = await fy.findById(req.user.financialYear);
    const lrNumber = await getPrintNumber(db, req.user, "lrCALC")
    res.render("transactions/booking/lr", { clientData: clientData, lrNumber, lrDATA: lrDATA, branchData: branchData, cityData: cityData, mopData: mopData, goodsDescriptionData: goodsDescriptionData, vehicleData: vehicleData })
})

//Sending Branch Code
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so we add 1
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
}



//creates new lr
Route.post("/transactions/booking/lorry-reciept/new", async (req, res) => {
    const db = req.dbConnection
    const branches = db.model("branches", branchesSchema)
    const ledgers = db.model("ledgers", ledgersSchema)
    const cities = db.model("cities", citiesSchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const users = db.model("users", usersSchema)
    const fy = db.model("financial-years", fySchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const {
            lrNumber, loadType, vehicle, lrDate, from, to, consignor, consignee, consignorGST, consigneeGST, selectDeliverySource, deliverySource, selectBookingSource, bookingSource,
            billedAt, billedTo, gstPaidBy, numberOfPackages, MOP, goodsDescription, actualWeight, chargedWeight,
            rateON, rate, amount, invoiceNumber, invoiceValue, ewayBillNumber, expiry,
            deliveryBy, materialHold, holdAt, pod, risk, deliveryAddress, basicFreight, collectionCharges, deliveryCharges, labourCharges,
            rebookingCharges, loadingDetention, unloadingDetention, demmurages, unloadingCharges, exWeight,
            exHeight, stCharges, others, subTotal,
            CGST, SGST, IGST
        } = req.body;


        const requiredFields = [loadType, lrDate, from, to, consignor, consignee, consignorGST, consigneeGST, billedAt, billedTo, gstPaidBy];
        const bookingItemFields = [numberOfPackages, MOP, goodsDescription, actualWeight, chargedWeight, rateON, rate, amount];
        const ewayFields = [invoiceNumber, invoiceValue, ewayBillNumber, expiry];
        // Check if required fields are missing
        if (requiredFields.some(field => !field)) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Fill All Required Fields" });
        }

        // Check if at least one booking item is provided
        if (bookingItemFields.every(field => !field)) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Add At Least 1 Booking Item" });
        }

        if (loadType === "FTL" && !vehicle) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select Vehicle Number" });
        }

        if (invoiceValue >= 50000 && (ewayBillNumber.length !== 14)) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Enter a Valid E-Way Bill Number" });
        }

        if (!deliveryBy) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select A Delivery Method" });
        }

        // Check if at least one invoice details is provided
        if (ewayFields.every(field => !field)) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Add At Least 1 Invoice Detail" });
        }

        // Fetch client data
        const [consignorData, consigneeData] = await Promise.all([
            ledgers.findById(consignor),
            ledgers.findById(consignee)
        ]);


        let atBookingGodown = false
        let atDeliveryGodown = false
        if (materialHold) {
            if (holdAt) {
                atBookingGodown = true
            } else {
                atDeliveryGodown = true
            }
        }

        let podVal = true
        if (!pod) {
            podVal = false
        }

        let riskVal = false
        if (risk) {
            riskVal = true
        }

        const materialHoldObject = {
            atBookingGodown: atBookingGodown,
            atDeliveryGodown: atDeliveryGodown
        }
        // Convert non-array fields into arrays if needed
        const packagesArray = Array.isArray(numberOfPackages) ? numberOfPackages : [numberOfPackages];
        const MOPArray = Array.isArray(MOP) ? MOP : [MOP];
        const goodsDescriptionArray = Array.isArray(goodsDescription) ? goodsDescription : [goodsDescription];
        const actualWeightArray = Array.isArray(actualWeight) ? actualWeight : [actualWeight];
        const chargedWeightArray = Array.isArray(chargedWeight) ? chargedWeight : [chargedWeight];
        const rateONArray = Array.isArray(rateON) ? rateON : [rateON];
        const rateArray = Array.isArray(rate) ? rate : [rate];
        const amountArray = Array.isArray(amount) ? amount : [amount];
        const ewayBillArray = Array.isArray(ewayBillNumber) ? ewayBillNumber : [ewayBillNumber];
        const expiryArray = Array.isArray(expiry) ? expiry : [expiry]
        const invoiceNumberArray = Array.isArray(invoiceNumber) ? invoiceNumber : [invoiceNumber];
        const invoiceValueArray = Array.isArray(invoiceValue) ? invoiceValue : [invoiceValue];

        const ewayBillsObject = ewayBillArray.map((ewayBillNumber, index) => ({
            ewayBillNumber,
            ewayBillExpiry: expiryArray[index],
            invoiceNumber: invoiceNumberArray[index],
            invoiceValue: invoiceValueArray[index]

        }))
        const materials = packagesArray.map((qty, index) => ({
            qty,
            packaging: MOPArray[index],
            goodsDescription: goodsDescriptionArray[index],
            actualWeight: actualWeightArray[index],
            chargedWeight: chargedWeightArray[index],
            rateON: rateONArray[index],
            rate: rateArray[index],
            amount: amountArray[index]
        }));

        // Calculate totals
        const totalQTY = packagesArray.reduce((acc, qty) => acc + parseFloat(qty), 0);
        const totalActualWeight = actualWeightArray.reduce((acc, weight) => acc + parseFloat(weight), 0);
        const totalChargedWeight = chargedWeightArray.reduce((acc, weight) => acc + parseFloat(weight), 0);
        const totalAmount = amountArray.reduce((acc, itemAmount) => acc + parseFloat(itemAmount), 0);
        let modifiedVehicle = loadType === "PTL" ? null : vehicle

        const fyData = await fy.findOne({ _id: req.user.financialYear }).session(session)
        const newLRNumber = await updatePrintNumber(db, session, req.user, 'lrCALC', lrNumber)



        const materialStatusObject = {
            qty: totalQTY,
            actualWeight: totalActualWeight,
            chargedWeight: totalChargedWeight
        }

        const freightDetails = {
            basicFreight,
            collectionCharges,
            deliveryCharges,
            labourCharges,
            rebookingCharges,
            loadingDetention,
            unloadingDetention,
            demmurage: demmurages,
            unloadingCharges,
            exWeight,
            exHeight,
            stCharges,
            others,
            CGST,
            SGST,
            IGST
        }

        let deliverySourceVal = null
        let bookingSourceVal = null

        if (deliverySource) {
            deliverySourceVal = selectDeliverySource
        }

        if (bookingSource) {
            bookingSourceVal = selectBookingSource
        }
        // Create the new LR object
        const newLR = new lr({
            lrNumber: newLRNumber,
            loadType: loadType,
            vehicle: modifiedVehicle,
            date: lrDate,
            from: from,
            to: to,
            bookingBranch: req.user.branch.id,
            bookingGodown: req.user.godown.id,
            consignorName: consignorData.name,
            consignorGST: consignorData.taxation.GST,
            consignor: consignor,
            consigneeName: consigneeData.name,
            consigneeGST: consigneeData.taxation.GST,
            consignee: consignee,
            deliverySource: deliverySourceVal,
            bookingSource: bookingSourceVal,
            billedAt: billedAt,
            billedTo: billedTo,
            gstPaidBy: gstPaidBy,
            ewayBill: ewayBillsObject,
            materialHold: materialHoldObject,
            pod: podVal,
            risk: riskVal,
            deliveryBy: deliveryBy,
            deliveryAddress: deliveryAddress,
            'materialStatus.atBookingGodown': materialStatusObject,
            material: materials,
            total: {
                qty: totalQTY,
                actualWeight: totalActualWeight,
                chargedWeight: totalChargedWeight,
                amount: totalAmount
            },
            freightDetails,
            createdBy: req.user.id,
            financialYear: req.user.financialYear
        });

        const newLRData = await newLR.save({ session });

        // Updating LR in branch where it's created
        await branches.findByIdAndUpdate(req.user.branch.id, { $push: { lr: newLRData.id } }).session(session)

        // Updating LR in billing branch
        await branches.findByIdAndUpdate(billedAt, { $push: { billingLR: newLRData.id } }).session(session)

        // Updating LR in user
        await users.findByIdAndUpdate(req.user.id, { $push: { lr: newLRData.id } }).session(session)

        // Updating LR in from city
        await cities.findByIdAndUpdate(from, { $push: { fromLR: newLRData.id } }).session(session)

        // Updating LR in to city
        await cities.findByIdAndUpdate(to, { $push: { toLR: newLRData.id } }).session(session)

        // const fyDATA = await fy.findOne({ financialYear: customFY(lrDate) }).session(session)
        // if (req.user.godown.serialToUse === "godown") {
        //     const filtered = fyDATA.lrCALC.find(element => element.type === "godown" && element.location.toString() === req.user.godown.id.toString())

        //     filtered.lrNumber.push(newLRData.id)
        // } else if (req.user.godown.serialToUse === "branch") {
        //     const filtered = fyDATA.lrCALC.find(element => element.type === "branch" && element.location.toString() === req.user.branch.id.toString())
        //     filtered.lrNumber.push(newLRData.id)
        // }
        // fyDATA.LR.push(newLRData.id)
        // await fyDATA.save()
        if (typeof modifiedVehicle !== null) {
            // Updating LR in vehicle
            await vehicles.findByIdAndUpdate(modifiedVehicle, { $push: { lr: newLRData.id } }).session(session)
        }

        await session.commitTransaction()
        res.sendStatus(200);


    } catch (error) {
        await session.abortTransaction()
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
    } finally {
        session.endSession()
    }
});




//sends lr enquiry data on lr page
Route.post("/transactions/booking/lorry-reciepts/data", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const branch = db.model("branches", branchesSchema)
    const from = db.model("cities", citiesSchema)
    const to = db.model("cities", citiesSchema)

    const branchData = await branch.find({})
    const dateRange = req.body.dateRange.split(' - ');
    const startDate = moment(dateRange[0], 'D-M-YYYY').toDate();
    const endDate = moment(dateRange[1], 'D-M-YYYY').toDate();
    let lrDATA
    if (req.user.role.roleType === "ADMIN") {
        lrDATA = await lr.find({ bookingBranch: req.body.branch })
    } else {
        lrDATA = await lr.find({ bookingBranch: req.user.branch })
    }
    const lrToSend = []

    if (lrDATA) {
        for (const lr of lrDATA) {
            const date = moment(lr.date, 'D-M-YYYY').toDate()
            if (date >= startDate && date <= endDate) {
                lrToSend.push(lr.id)
            }
        }
    }



    if (lrToSend.length < 1) {
        return res.status(400).send({ message: "NO LR FOUND" })
    } else {
        const objectIds = lrToSend.map(id => mongoose.Types.ObjectId(id));
        const newLRData = await lr.find({ _id: { $in: lrToSend } }).populate("from").populate("to").populate("billedAt")
        return res.status(200).send(newLRData)

    }
})


Route.get("/transactions/booking/lorry-reciept/get-lr-detail", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const ro = db.model("rate-ons", roSchema)


    const lrDATA = await await lr.findById(req.query.id);


    if (lrDATA.total.qty == lrDATA.materialStatus.delivered.qty) {
        return res.status(400).send({ message: "LR Already Delivered" })
    } else {

        for (const material of lrDATA.material) {
            if (!["actualWeight", "chargedWeight", "PKG", "FTL"].includes(material.rateON) &&
                material.rateON !== null &&
                material.rateON !== undefined &&
                material.rateON !== "") {
                const roDATA = await ro.findById(material.rateON);
                material.rateON = roDATA;

            }

        }

        res.status(200).send(lrDATA)

    }




})


//update route for lr
Route.post("/transactions/booking/lorry-reciept/update", async (req, res) => {
    const db = req.dbConnection
    const branches = db.model("branches", branchesSchema)
    const ledgers = db.model("ledgers", ledgersSchema)
    const cities = db.model("cities", citiesSchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const users = db.model("users", usersSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const {
            lrNumberUpdate, loadType, vehicle, lrDate, from, to, consignor, consignee, consignorGST, consigneeGST, selectDeliverySource, deliverySource, selectBookingSource, bookingSource,
            billedAt, billedTo, gstPaidBy, materialID, numberOfPackages, MOP, goodsDescription, actualWeight, chargedWeight,
            rateON, rate, amount, invoiceNumber, expiry, deliveryBy, materialHold, holdAt, pod, risk, invoiceValue, ewayBillNumber,
            deliveryAddress, basicFreight, collectionCharges, deliveryCharges, labourCharges,
            rebookingCharges, loadingDetention, unloadingDetention, demmurages, unloadingCharges, exWeight,
            exHeight, stCharges, others, subTotal, CGST, SGST, IGST
        } = req.body;

        const requiredFields = [loadType, lrDate, from, to, consignor, consignee, consignorGST, consigneeGST, billedAt, billedTo, gstPaidBy];
        const bookingItemFields = [numberOfPackages, MOP, goodsDescription, actualWeight, chargedWeight, rateON, rate, amount];
        const ewayFields = [invoiceNumber, invoiceValue, ewayBillNumber, expiry];
        // Check if required fields are missing
        if (requiredFields.some(field => !field)) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Fill All Required Fields" });
        }

        // Check if at least one booking item is provided
        if (bookingItemFields.every(field => !field)) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Add At Least 1 Booking Item" });
        }



        if (loadType === "FTL" && !vehicle) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select Vehicle Number" });
        }



        if (!deliveryBy) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select A Delivery Method" });
        }

        // Check if at least one booking item is provided
        if (ewayFields.every(field => !field)) {
            return res.status(400).send({ message: "Please Add At Least 1 Invoice Detail" });
        }

        // Convert non-array fields into arrays if needed
        const typeArray = Array.isArray(materialID) ? materialID : [materialID];
        const packagesArray = Array.isArray(numberOfPackages) ? numberOfPackages : [numberOfPackages];
        const MOPArray = Array.isArray(MOP) ? MOP : [MOP];
        const goodsDescriptionArray = Array.isArray(goodsDescription) ? goodsDescription : [goodsDescription];
        const actualWeightArray = Array.isArray(actualWeight) ? actualWeight : [actualWeight];
        const chargedWeightArray = Array.isArray(chargedWeight) ? chargedWeight : [chargedWeight];
        const rateONArray = Array.isArray(rateON) ? rateON : [rateON];
        const rateArray = Array.isArray(rate) ? rate : [rate];
        const amountArray = Array.isArray(amount) ? amount : [amount];

        //total material input recieved from user
        const totalNOP = packagesArray.reduce((value, currentValue) => { return value + parseInt(currentValue) }, 0)
        const totalActualWeight = actualWeightArray.reduce((value, currentValue) => { return value + parseInt(currentValue) }, 0)
        const totalChargedWeight = chargedWeightArray.reduce((value, currentValue) => { return value + parseInt(currentValue) }, 0)
        const totalAMT = amountArray.reduce((value, currentValue) => { return value + parseInt(currentValue) }, 0)
        //total material that is alredy dispatched from booking godown

        const lrDATA = await lr.findById(lrNumberUpdate).session(session)

        const dispatchedNOP = lrDATA.total.qty - lrDATA.materialStatus.atBookingGodown.qty
        const dispatchedActualWeight = lrDATA.total.actualWeight - lrDATA.materialStatus.atBookingGodown.actualWeight
        const dispatchedChargedWeight = lrDATA.total.chargedWeight - lrDATA.materialStatus.atBookingGodown.chargedWeight

        //making sure that user doesnt removes more material from lr than available at booking godown
        if (totalNOP < dispatchedNOP) {
            await session.abortTransaction()
            return res.status(400).send({ message: "You Cannot Remove More NOP Than Available At Booing Godown. To Remove This First Edit The Challan & Remove Material From There" });
        } else if (totalActualWeight < dispatchedActualWeight) {
            await session.abortTransaction()
            return res.status(400).send({ message: "You Cannot Remove More Actual Weight Than Available At Booing Godown. To Remove This First Edit The Challan & Remove Material From There" });

        } else if (totalChargedWeight < dispatchedChargedWeight) {
            await session.abortTransaction()
            return res.status(400).send({ message: "You Cannot Remove More Charged Weight Than Available At Booing Godown. To Remove This First Edit The Challan & Remove Material From There" });
        }

        //updating total columns in lr database
        lrDATA.total.actualWeight = totalActualWeight
        lrDATA.total.qty = totalNOP
        lrDATA.total.chargedWeight = totalChargedWeight
        lrDATA.total.amount = totalAMT

        //calculating of material at booking godown by subtracting material with dispactehd material which we calculated above
        const bookingNOP = totalNOP - dispatchedNOP
        const bookingActualWeight = totalActualWeight - dispatchedActualWeight
        const bookingChargedWeight = totalChargedWeight - dispatchedChargedWeight

        //updating material status at booking godown
        lrDATA.materialStatus.atBookingGodown.qty = bookingNOP
        lrDATA.materialStatus.atBookingGodown.actualWeight = bookingActualWeight
        lrDATA.materialStatus.atBookingGodown.chargedWeight = bookingChargedWeight

        const newMaterialIndex = []
        const updated = []
        // now we will update indvidual material rows
        for (i = 0; i < packagesArray.length; i++) {
            if (typeArray[i] === "NEW") {
                newMaterialIndex.push(i)

            } else {
                const foundIndex = lrDATA.material.findIndex(element => element.id === typeArray[i])
                lrDATA.material[foundIndex].qty = packagesArray[i]
                lrDATA.material[foundIndex].actualWeight = actualWeightArray[i]
                lrDATA.material[foundIndex].chargedWeight = chargedWeightArray[i]
                lrDATA.material[foundIndex].goodsDescription = goodsDescriptionArray[i]
                lrDATA.material[foundIndex].packaging = MOPArray[i]
                lrDATA.material[foundIndex].rateON = rateONArray[i]
                lrDATA.material[foundIndex].rate = rateArray[i]
                lrDATA.material[foundIndex].amount = amountArray[i]
                updated.push(foundIndex)
            }
        }


        //removing materials that have been completely removed
        for (i = 0; i < lrDATA.material.length; i++) {
            const ifUpdated = updated.find(element => element === i)
            if (typeof ifUpdated === "undefined") {
                lrDATA.material.pull(lrDATA.material[i])
                await lrDATA.save()

            }
        }


        //creating new material now
        for (i = 0; i < packagesArray.length; i++) {
            const ifNew = newMaterialIndex.find(element => element === i)
            if (typeof ifNew !== "undefined") {
                const materialObject = {
                    qty: packagesArray[i],
                    goodsDescription: goodsDescriptionArray[i],
                    packaging: MOPArray[i],
                    actualWeight: actualWeightArray[i],
                    chargedWeight: chargedWeightArray[i],
                    rateON: rateONArray[i],
                    rate: rateArray[i],
                    amount: amountArray[i]

                }

                lrDATA.material.push(materialObject)
                await lrDATA.save()
            }
        }

        if (lrDATA.billedAT !== billedAt) {
            await branches.findByIdAndUpdate(lrDATA.billedAt, { $pull: { billingLR: lrNumberUpdate } }).session(session)
            await branches.findByIdAndUpdate(billedAt, { $push: { billingLR: lrNumberUpdate } }).session(session)
        }

        if (lrDATA.loadType === "FTL") {
            await vehicles.findByIdAndUpdate(lrDATA.vehicle, { $pull: { lr: lrNumberUpdate } }).session()
        }

        //now since we successfully updated LR material, now we will proceed to update basic details in LR
        const [consignorData, consigneeData] = await Promise.all([
            ledgers.findById(consignor),
            ledgers.findById(consignee)
        ]);

        let atBookingGodown = false
        let atDeliveryGodown = false
        if (materialHold) {
            if (holdAt) {
                atBookingGodown = true
            } else {
                atDeliveryGodown = true
            }
        }




        let podVal = true
        if (!pod) {
            podVal = false
        }

        let riskVal = false
        if (risk) {
            riskVal = true
        }

        lrDATA.materialHold = {}
        await lrDATA.save()

        const materialHoldObject = {
            atBookingGodown: atBookingGodown,
            atDeliveryGodown: atDeliveryGodown
        }
        lrDATA.materialHold = materialHoldObject
        await lrDATA.save()
        let modifiedVehicle = loadType === "PTL" ? null : vehicle

        let deliverySourceVal = null
        let bookingSourceVal = null

        if (deliverySource) {
            deliverySourceVal = selectDeliverySource
        }

        if (bookingSource) {
            bookingSourceVal = selectBookingSource
        }

        lrDATA.loadType = loadType
        lrDATA.vehicle = modifiedVehicle
        lrDATA.date = lrDate
        lrDATA.from = from
        lrDATA.to = to
        lrDATA.bookingBranch = req.user.branch.id
        lrDATA.consignorName = consignorData.name
        lrDATA.consignorGST = consignorData.taxation.GST
        lrDATA.consignor = consignor
        lrDATA.consigneeName = consigneeData.name
        lrDATA.consigneeGST = consigneeData.taxation.GST
        lrDATA.consignee = consignee
        lrDATA.deliverySource = deliverySourceVal
        lrDATA.bookingSource = bookingSourceVal
        lrDATA.billedAt = billedAt
        lrDATA.billedTo = billedTo
        lrDATA.gstPaidBy = gstPaidBy


        lrDATA.deliveryBy = deliveryBy
        lrDATA.deliveryAddress = deliveryAddress

        lrDATA.pod = podVal
        lrDATA.risk = riskVal

        lrDATA.freightDetails.basicFreight = basicFreight
        lrDATA.freightDetails.collectionCharges = collectionCharges
        lrDATA.freightDetails.deliveryCharges = deliveryCharges
        lrDATA.freightDetails.labourCharges = labourCharges
        lrDATA.freightDetails.rebookingCharges = rebookingCharges
        lrDATA.freightDetails.loadingDetention = loadingDetention
        lrDATA.freightDetails.unloadingDetention = unloadingDetention
        lrDATA.freightDetails.demmurage = demmurages
        lrDATA.freightDetails.unloadingCharges = unloadingCharges
        lrDATA.freightDetails.exWeight = exWeight
        lrDATA.freightDetails.exHeight = exHeight
        lrDATA.freightDetails.stCharges = stCharges
        lrDATA.freightDetails.others = others
        lrDATA.freightDetails.CGST = CGST
        lrDATA.freightDetails.SGST = SGST
        lrDATA.freightDetails.IGST = IGST




        const ewayBillArray = Array.isArray(ewayBillNumber) ? ewayBillNumber : [ewayBillNumber];
        const expiryArray = Array.isArray(expiry) ? expiry : [expiry]
        const invoiceNumberArray = Array.isArray(invoiceNumber) ? invoiceNumber : [invoiceNumber];
        const invoiceValueArray = Array.isArray(invoiceValue) ? invoiceValue : [invoiceValue];

        const ewayBillsObject = ewayBillArray.map((ewayBillNumber, index) => ({
            ewayBillNumber,
            ewayBillExpiry: expiryArray[index],
            invoiceNumber: invoiceNumberArray[index],
            invoiceValue: invoiceValueArray[index]

        }))

        if (loadType === "FTL") {
            await vehicles.findByIdAndUpdate(vehicle, { $push: { lr: lrNumberUpdate } }).session(session)
        }


        lrDATA.ewayBill = []
        lrDATA.ewayBill = ewayBillsObject
        await lrDATA.save()
        await session.commitTransaction()
        return res.sendStatus(200);


    } catch (err) {
        await session.abortTransaction()
        console.log(err)
        return res.sendStatus(500)
    } finally {
        session.endSession()
    }
})



//delete route for lr
Route.get("/transactions/booking/lorry-reciept/delete", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const branch = db.model("branches", branchesSchema)
    const cities = db.model("cities", citiesSchema)
    const fy = db.model("financial-years", fySchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const lrDATA = await lr.findById(req.query.id).session(session)
        if (lrDATA.challans.length > 0) {
            await session.abortTransaction()
            return res.status(400).send({ message: "This LR Cant Be Deleted Since Material Is Dispatched" });

        } else {
            await branch.findByIdAndUpdate(lrDATA.bookingBranch, { $pull: { lr: req.query.id } }).session(session)
            await branch.findByIdAndUpdate(lrDATA.billedAT, { $pull: { lr: req.query.id } }).session(session)
            await cities.findByIdAndUpdate(lrDATA.from, { $pull: { fromLR: req.query.id } }).session(session)
            await cities.findByIdAndUpdate(lrDATA.to, { $pull: { toLR: req.query.id } }).session(session)

            if (lrDATA.loadType === "FTL") {
                await vehicles.findByIdAndUpdate(lrDATA.vehicle, { $pull: { lr: req.query.id } }).session(session)
            }

            await lr.findByIdAndDelete(req.query.id).session(session)


            const fyDATA = await fy.findOne({ financialYear: customFY(lrDATA.date) })

            fyDATA.lr.pull(req.query.id)


            await fyDATA.save()

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
Route.get("/masters/rates/rate-master/get-rate-on", async (req, res) => {

    const db = req.dbConnection
    const cdr = db.model("client-default-rates", cdrSchema)
    const ro = db.model("rate-on", roSchema)
    const { billedTo, from, to } = req.query

    const data = await cdr.find({
        from: { $elemMatch: { $eq: from } },
        to: { $elemMatch: { $eq: to } },
        client: billedTo,
        for: "client"
    }).populate("rateON")

    const cityDefault = await cdr.find({
        from: { $elemMatch: { $eq: from } },
        to: { $elemMatch: { $eq: to } },
        for: "city"
    }).populate("rateON")

    if (data.length > 0) {
        const info = data.map(element => {
            return {
                rateON: element.rateON.rateON,
                id: element.rateON.id
            }
        })

        res.status(200).send(info)
    } else if (cityDefault.length > 0) {

        const info = cityDefault.map(element => {
            return {
                rateON: element.rateON.rateON,
                id: element.rateON.id
            }
        })

        res.status(200).send(info)
    } else {
        const info = [
            {
                rateON: "Actual Weight",
                id: "actualWeight"
            }, {
                rateON: "Charged Weight",
                id: "chargedWeight"
            }, {
                rateON: "Packages",
                id: "PKG"
            }, {
                rateON: "FTL (Fix)",
                id: "FTL"
            },
        ]


        res.status(200).send(info)
    }


})
Route.get("/masters/rates/rate-master/get-rate", async (req, res) => {

    const db = req.dbConnection
    const cdr = db.model("client-default-rates", cdrSchema)
    const { billedTo, from, to, NOP, actualWeight, chargedWeight, rateON } = req.query

    const data = await cdr.findOne({
        from: { $elemMatch: { $eq: from } },
        to: { $elemMatch: { $eq: to } },
        client: billedTo,
        rateON: rateON,
        for: "client"
    });
    const cityDefault = await cdr.findOne({
        from: { $elemMatch: { $eq: from } },
        to: { $elemMatch: { $eq: to } },
        rateON: rateON,
        for: "city"
    });

    if (data) {

        const defaultRateArray = []
        for (const info of data.defaultRate) {
            if (info.basic > 0) {
                const object = {
                    chargeType: info.charge,
                    amount: info.basic
                }
                defaultRateArray.push(object)
            } else if (info.chargeType === "chargedWeight") {
                const filtered = parseFloat(chargedWeight) >= info.from && parseFloat(chargedWeight) <= info.to
                if (filtered) {
                    const object = {
                        chargeType: info.charge,
                        amount: parseInt(chargedWeight) * info.amount
                    }
                    defaultRateArray.push(object)
                }

            } else if (info.chargeType === "actualWeight") {
                const filtered = parseFloat(actualWeight) >= info.from && parseFloat(actualWeight) <= info.to
                if (filtered) {
                    const object = {
                        chargeType: info.charge,
                        amount: parseInt(actualWeight) * info.amount
                    }
                    defaultRateArray.push(object)
                }
            } else if (info.chargeType === "PKG") {
                const filtered = parseFloat(NOP) >= info.from && parseFloat(NOP) <= info.to
                if (filtered) {
                    const object = {
                        chargeType: info.charge,
                        amount: parseInt(NOP) * info.amount
                    }
                    defaultRateArray.push(object)
                }
            } else if (info.chargeType === "FTL") {
                const filtered = parseFloat(NOP) >= info.from && parseFloat(NOP) <= info.to
                if (filtered) {
                    const object = {
                        chargeType: info.charge,
                        amount: info.amount
                    }
                    defaultRateArray.push(object)

                }
            }
        }

        if (defaultRateArray.length > 0) {
            res.status(200).send(defaultRateArray)
        } else {
            res.sendStatus(400)
        }
    } else if (cityDefault) {

        const defaultRateArray = []
        for (const info of cityDefault.defaultRate) {

            if (info.basic > 0) {
                const object = {
                    chargeType: info.charge,
                    amount: info.basic
                }
                defaultRateArray.push(object)
            } else if (info.chargeType === "chargedWeight") {
                const filtered = parseFloat(chargedWeight) >= info.from && parseFloat(chargedWeight) <= info.to
                if (filtered) {
                    const object = {
                        chargeType: info.charge,
                        amount: parseInt(chargedWeight) * info.amount
                    }
                    defaultRateArray.push(object)
                }

            } else if (info.chargeType === "actualWeight") {
                const filtered = parseFloat(actualWeight) >= info.from && parseFloat(actualWeight) <= info.to
                if (filtered) {
                    const object = {
                        chargeType: info.charge,
                        amount: parseInt(actualWeight) * info.amount
                    }
                    defaultRateArray.push(object)
                }
            } else if (info.chargeType === "PKG") {
                const filtered = parseFloat(NOP) >= info.from && parseFloat(NOP) <= info.to
                if (filtered) {
                    const object = {
                        chargeType: info.charge,
                        amount: parseInt(NOP) * info.amount
                    }
                    defaultRateArray.push(object)
                }
            } else if (info.chargeType === "FTL") {
                const filtered = parseFloat(NOP) >= info.from && parseFloat(NOP) <= info.to
                if (filtered) {
                    const object = {
                        chargeType: info.charge,
                        amount: info.amount
                    }
                    defaultRateArray.push(object)

                }
            }
        }

        if (defaultRateArray.length > 0) {

            res.status(200).send(defaultRateArray)
        } else {
            res.sendStatus(400)
        }

    } else {
        res.sendStatus(400)
    }



})
const { PDFDocument } = require('pdf-lib');

Route.get("/transactions/booking/lorry-reciepts/download", async (req, res) => {

    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const users = db.model("users", usersSchema)
    const branches = db.model("branches", branchesSchema)
    const cities = db.model("cities", citiesSchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const ledgers = db.model("ledgers", ledgersSchema)
    const goodsDescription = db.model("goods-description", goodsDescriptionSchema)
    const mop = db.model("method-of-packaging", mopSchema)
    const data = await lr.findById(req.query.id).populate("from").populate("to").populate("billedAt").populate("consignor").populate("consignee").populate("vehicle").populate("material.packaging").populate("material.goodsDescription").populate("bookingBranch").populate("createdBy")
    // const templatePath = "./views/templates/lorry-reciept.ejs";
    // const template = fs.readFileSync(templatePath, "utf-8");
    // const html = ejs.render(template);
    // const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    // const page = await browser.newPage();
    // // Set the viewport size to match legal paper size
    // // Set the content of the page
    // await page.setContent(html);

    // // Capture a PDF of the entire page
    // await page.pdf({
    //     path: "ok.pdf",
    //     format: 'Legal', // Specify the format to match legal paper size
    //     margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
    //     preferCSSPageSize: true// Include background colors and images
    // });

    // await browser.close();


    // // Remove the extra page using pdf-lib
    // const pdfBuffer = fs.readFileSync('ok.pdf');
    // const pdfDoc = await PDFDocument.load(pdfBuffer);

    // // Remove the last page
    // pdfDoc.removePage(2 - 1);

    // const modifiedPdfBytes = await pdfDoc.save();
    // fs.writeFileSync('ok.pdf', modifiedPdfBytes);

    // res.download("ok.pdf");
    res.render("templates/lorry-reciept", { data: data })

})
module.exports = Route