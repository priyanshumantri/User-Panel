const express = require("express")
const Route = express.Router()
const groupSchema = require("../../models/masters/groups")
const ledgerSchema = require("../../models/masters/ledgers")
const freightInvoiceSchema = require("../../models/transactions/accounts/freight-invoice")
const getLedgers = require("../../custom_modules/accounts/getLedgers")
const newEntry = require("../../custom_modules/accounts/newEntry")
const recieptVoucher = require("../../models/accounts/reciepts")
const newRefSchema = require("../../models/accounts/new")
const { getPrintNumber, updatePrintNumber } = require("../../custom_modules/serialCalculator")
const removeEntry = require("../../custom_modules/accounts/removeEntry")
const mongoose = require('mongoose');
const findByIdOrNull = require("../../custom_modules/findByIdOrNull")

Route.get("/accounts/reciepts", async (req, res) => {
  const db = req.dbConnection
  const ledger = db.model("ledgers", ledgerSchema)
  const group = db.model("groups", groupSchema)
  const recieptVoucherM = db.model("reciept-vouchers", recieptVoucher)
const ledgerData1 = await ledger.find({})
  const paymentData1 = await getLedgers(db, "cashinhand")
  const paymentData2 = await getLedgers(db, "bankaccount")


  paymentData1.forEach((info) => {
    info.type = "cashinhand"
  })
  paymentData2.forEach((info) => {
    info.type = "bankaccount"
  })

  const paymentData = paymentData1.concat(paymentData2)
  const recieptVoucherData = await recieptVoucherM.find({ createdAt: req.user.branch._id, fy: req.user.financialYear }).populate({
    path: "drEntry",
    populate: {
      path: "ledger"
    }
  }).populate({
    path: "crEntry",
    populate: {
      path: "ledger"
    }
  })

     //removing cashinhand, bank account, lorry hire creditors from ledgerData
     for (const data of paymentData1) {
      const found = ledgerData1.find(ledger => ledger.id === data.id);
      ledgerData1.splice(ledgerData1.indexOf(found), 1);
  }
  for (const data of paymentData2) {
      const found = ledgerData1.find(ledger => ledger.id === data.id);
      ledgerData1.splice(ledgerData1.indexOf(found), 1);
  }


  const printNumber = await getPrintNumber(db, req.user, "recieptCALC")
  res.render("accounts/reciepts", { sundryDebtorData: ledgerData1, paymentData: paymentData, recieptVoucherData: recieptVoucherData, printNumber: printNumber })
})

Route.get("/accounts/reciepts/get-details", async (req, res) => {
  const db = req.dbConnection
  const ledger = db.model("ledgers", ledgerSchema)
  const freighInvoice = db.model("freight-invoices", freightInvoiceSchema)
  const newRef = db.model("new-references", newRefSchema)
  const { id } = req.query
  const ledgerData = await ledger.findById(id)
  let totalDR = 0
  let totalCR = 0
  for (i = 0; i < ledgerData.transactions.length; i++) {

    if (ledgerData.transactions[i].type === "dr") {
      totalDR += ledgerData.transactions[i].amount
    } else {
      totalCR += ledgerData.transactions[i].amount
    }

  }

  let netBalance = totalDR - totalCR
  let references = []

  //now we will calculate net balance of each refrence and send it to the client if net balance != 0
  let refDone = []
  for (i = 0; i < ledgerData.transactions.length; i++) {
    const done = refDone.includes(ledgerData.transactions[i].reference.rel)
    if (!done) {
      if (ledgerData.transactions[i].reference.type !== "onAccount") {
        let currentRefDr = 0
        let currentRefCr = 0
        for (j = 0; j < ledgerData.transactions.length; j++) {
          if (ledgerData.transactions[j].reference.rel == ledgerData.transactions[i].reference.rel) {
            if (ledgerData.transactions[j].type == "dr") {
              currentRefDr += ledgerData.transactions[j].amount
            } else {
              currentRefCr += ledgerData.transactions[j].amount
            }
          }
        }
        let currrentRefNetBalance = currentRefDr - currentRefCr
        if (req.query.type == "cr") {
          if (currrentRefNetBalance > 0) {
            refDone.push(ledgerData.transactions[i].reference.rel)
            references.push({ type: ledgerData.transactions[i].reference.type, rel: ledgerData.transactions[i].reference.rel, netBalance: currrentRefNetBalance })
          }
        } else {
          if (currrentRefNetBalance < 0) {
            refDone.push(ledgerData.transactions[i].reference.rel)
            references.push({ type: ledgerData.transactions[i].reference.type, rel: ledgerData.transactions[i].reference.rel, netBalance: currrentRefNetBalance })
          }
        }
      }
    }

  }

  let constructedReferences = []


  //setting display value for each reference

  for (i = 0; i < references.length; i++) {
    if (references[i].type == "freightInvoice") {
      let freightInvoiceData = await freighInvoice.findById(references[i].rel)
      const newObject = {
        rel: references[i].rel,
        display: freightInvoiceData.billNumber,
        netBalance: Math.abs(references[i].netBalance)
      }
      constructedReferences.push(newObject)
    } else if (references[i].type == "new") {
      let newRefData = await newRef.findById(references[i].rel)
      const newObject = {
        rel: references[i].rel,
        display: newRefData.number,
        netBalance: Math.abs(references[i].netBalance)
      }
      constructedReferences.push(newObject)

    } else {
      const newObject = {
        rel: references[i].rel,
        display: references[i].rel,
        netBalance: Math.abs(references[i].netBalance)
      }
      constructedReferences.push(newObject)
    }
  }

  return res.status(200).send({ netBalance, constructedReferences })
})



Route.post("/accounts/reciepts/new", async (req, res) => {
  const db = req.dbConnection
  const rvSchema = db.model("reciept-vouchers", recieptVoucher)
  const ledger = db.model("ledgers", ledgerSchema)
  const freightInvoice = db.model("freight-invoices", freightInvoiceSchema)
  const ref = db.model("new-references", newRefSchema)
  const session = await db.startSession()
  session.startTransaction()
  try {
    const { voucherNumber, recieptDate, ledgerCR, chNumber, referenceTypeCr, referenceNumberCR, amountCr, recievedAmtCr, balanceCr, ledgerDR, referenceTypeDr, referenceNumberDR, amountDr, recievedAmtDr, balanceDr } = req.body

    //form validation
    if (!voucherNumber || !recieptDate || !ledgerCR || !referenceTypeCr || !referenceNumberCR || !amountCr || !recievedAmtCr || !balanceCr || !ledgerDR || !referenceTypeDr || !referenceNumberDR || !amountDr || !recievedAmtDr || !balanceDr) {
      return res.status(400).send({ message: "All fields are required" })
    }

    // converting all non array fields to array
    let ledgerCRArray = Array.isArray(ledgerCR) ? ledgerCR : [ledgerCR]
    let referenceTypeCrArray = Array.isArray(referenceTypeCr) ? referenceTypeCr : [referenceTypeCr]
    let referenceNumberCrArray = Array.isArray(referenceNumberCR) ? referenceNumberCR : [referenceNumberCR]
    let amountCrArray = Array.isArray(amountCr) ? amountCr : [amountCr]
    let recievedAmtCrArray = Array.isArray(recievedAmtCr) ? recievedAmtCr : [recievedAmtCr]
    let balanceCrArray = Array.isArray(balanceCr) ? balanceCr : [balanceCr]
    let ledgerDRArray = Array.isArray(ledgerDR) ? ledgerDR : [ledgerDR]
    let referenceTypeDrArray = Array.isArray(referenceTypeDr) ? referenceTypeDr : [referenceTypeDr]
    let referenceNumberDrArray = Array.isArray(referenceNumberDR) ? referenceNumberDR : [referenceNumberDR]
    let amountDrArray = Array.isArray(amountDr) ? amountDr : [amountDr]
    let recievedAmtDrArray = Array.isArray(recievedAmtDr) ? recievedAmtDr : [recievedAmtDr]
    let balanceDrArray = Array.isArray(balanceDr) ? balanceDr : [balanceDr]
    let chNumberArray = Array.isArray(chNumber) ? chNumber : [chNumber]

    //sum of dr balance and cr balance should be equal
    const totalCr = recievedAmtCrArray.reduce((a, b) => parseFloat(a) + parseFloat(b), 0)
    const totalDr = recievedAmtDrArray.reduce((a, b) => parseFloat(a) + parseFloat(b), 0)

    if (totalCr != totalDr) {

      return res.status(400).send({ message: "Debit and credit balance should be equal" })
    }


    const drEntryArray = []
    const crEntryArray = []

    const updatePrintNumberData = await updatePrintNumber(db, session, req.user, "recieptCALC", voucherNumber)
    //creating new reciept voucher
    const newRecieptVoucher = new rvSchema({
      voucherNumber: updatePrintNumberData,
      fy: req.user.financialYear,
      date: recieptDate,
      drEntry: drEntryArray,
      crEntry: crEntryArray,
      createdAt: req.user.branch._id,
      createdBy: req.user._id
    })

    //saving new reciept voucher
    const rvData = await newRecieptVoucher.save({ session })


    let drArray = []
    //constructing drArray
    for (i = 0; i < ledgerDRArray.length; i++) {
      drArray.push({
        chNumber: chNumberArray[i],
        ledger: ledgerDRArray[i],
        referenceType: referenceTypeDrArray[i],
        referenceNumber: referenceNumberDrArray[i],
        amount: recievedAmtDrArray[i],
        transactionID: null
      })
    }

    let crArray = []
    //constructing crArray
    for (i = 0; i < ledgerCRArray.length; i++) {
      crArray.push({
        chNumber: null,
        ledger: ledgerCRArray[i],
        referenceType: referenceTypeCrArray[i],
        referenceNumber: referenceNumberCrArray[i],
        amount: recievedAmtCrArray[i],
        transactionID: null
      })
    }

    //new cr transactions
    let crAgainst = [] //used in drTransactions
    for (i = 0; i < ledgerCRArray.length; i++) {
      if (referenceTypeCrArray[i] == "against") {
        const fiData = await freightInvoice.findById(referenceNumberCrArray[i])
        if (fiData) {
          refToLink = "freightInvoice"
        } else {
          refToLink = "new"
        }
      } else if (referenceTypeCrArray[i] == "new") {
        refToLink = "new"
      } else if (referenceTypeCrArray[i] == "onAccount") {
        refToLink = "onAccount"
      }

      if (referenceTypeCrArray[i] == "new") {
        const refData = await ref.findById(referenceNumberCrArray[i])
        const newReference = new ref({
          date: recieptDate,
          number: refData ? refData.number : referenceNumberCrArray[i],
          ledger: ledgerCRArray[i],
          amount: recievedAmtCrArray[i],
          reference: {
            type: "reciept",
            rel: rvData._id
          }
        })
        const newRefData = await newReference.save({ session })
        const id = await newEntry(db, session, ledgerCRArray[i], recieptDate, req.user.financialYear, "cr", recievedAmtCrArray[i], "narration", "new", newRefData._id, [], "reciept", rvData._id)
        crAgainst.push({ ledger: ledgerCRArray[i], transactionID: id })
        crArray[i].referenceNumber = newRefData._id
      } else {
        const id = await newEntry(db, session, ledgerCRArray[i], recieptDate, req.user.financialYear, "cr", recievedAmtCrArray[i], "narration", refToLink, referenceNumberCrArray[i], [], "reciept", rvData._id)
        crAgainst.push({ ledger: ledgerCRArray[i], transactionID: id })
      }
    }

    //new dr transactions
    let drAgainst = [] //used in crTransactions
    for (i = 0; i < ledgerDRArray.length; i++) {
      if (referenceTypeDrArray[i] == "against") {
        const fiData = await freightInvoice.findById(referenceNumberDrArray[i])
        if (fiData) {
          refToLink = "freightInvoice"
        } else {
          refToLink = "new"
        }
      } else if (referenceTypeDrArray[i] == "new") {
        refToLink = "new"
      } else if (referenceTypeDrArray[i] == "onAccount") {
        refToLink = "onAccount"
      }
      if (referenceTypeDrArray[i] == "new") {
        const refData = await ref.findById(referenceNumberDrArray[i])
        const newReference = new ref({
          date: recieptDate,
          number: refData ? refData.number : referenceNumberDrArray[i],
          ledger: ledgerDRArray[i],
          amount: recievedAmtDrArray[i],
          reference: {
            type: "reciept",
            rel: rvData._id
          }
        })
        const newRefData = await newReference.save({ session })
        const id = await newEntry(db, session, ledgerDRArray[i], recieptDate, req.user.financialYear, "dr", recievedAmtDrArray[i], "narration", "new", newRefData._id, crAgainst, "reciept", rvData._id)
        drAgainst.push({ ledger: ledgerDRArray[i], transactionID: id })
        drArray[i].referenceNumber = newRefData._id
      } else {
        const id = await newEntry(db, session, ledgerDRArray[i], recieptDate, req.user.financialYear, "dr", recievedAmtDrArray[i], "narration", refToLink, referenceNumberDrArray[i], crAgainst, "reciept", rvData._id)
        drAgainst.push({ ledger: ledgerDRArray[i], transactionID: id })
      }
    }

    //updating against in cr entries
    for (i = 0; i < crAgainst.length; i++) {
      const ledgerData = await ledger.findById(crAgainst[i
      ].ledger).session(session)
      ledgerData.transactions.id(crAgainst[i].transactionID).against = drAgainst
      await ledgerData.save()
    }

    //updating drEntry and crEntry arrays
    for (i = 0; i < ledgerCRArray.length; i++) {
      crArray[i].transactionID = crAgainst[i].transactionID
    }
    for (i = 0; i < ledgerDRArray.length; i++) {
      drArray[i].transactionID = drAgainst[i].transactionID
    }

    //updating reciept voucher
    await rvSchema.findByIdAndUpdate(rvData._id, { drEntry: drArray, crEntry: crArray }, { session })
    await session.commitTransaction() 
    return res.sendStatus(200)

  } catch (err) {
    console.log(err)
    await session.abortTransaction()
    session.endSession()
    return res.sendStatus(500)
  } finally {
    session.endSession()
  }


})

Route.get("/accounts/reciepts/edit", async (req, res) => {
  const db = req.dbConnection
  const ledger = db.model("ledgers", ledgerSchema)
  const recieptVoucherM = db.model("reciept-vouchers", recieptVoucher)
  const newRef = db.model("new-references", newRefSchema)
  const freightInvoice = db.model("freight-invoices", freightInvoiceSchema)

  let data = await recieptVoucherM.findById(req.query.id).populate({
    path: "drEntry",
    populate: {
      path: "ledger"
    }
  }).populate({
    path: "crEntry",
    populate: {
      path: "ledger"
    }
  });

  let crEntryArray = []
  for (const info of data.crEntry) {
    info.balance = 0;
    if (info.referenceType === "new") {
      const ledgerData = await ledger.findById(info.ledger);
      const newRefData = await newRef.findById(info.referenceNumber);
      const balance = await getReferenceBalance(ledgerData, info.referenceNumber);
      const newObject = {
        ledger: info.ledger._id,
        ledgerDisplay: info.ledger.name,
        referenceType: info.referenceType,
        referenceNumber: info.referenceNumber,
        referenceNumberDisplay: newRefData.number,
        balance: Math.abs(balance),
        amount: info.amount,
        chNumber: null
      }
      crEntryArray.push(newObject)
    } else if (info.referenceType === "against") {
      const ledgerData = await ledger.findById(info.ledger);
      const freightInvoiceData = await freightInvoice.findById(info.referenceNumber);
      const balance = await getReferenceBalance(ledgerData, info.referenceNumber);
      let billNumber
      if (!freightInvoiceData) {
        const newRefData = await newRef.findById(info.referenceNumber);
        billNumber = newRefData.number
      } else {
         billNumber = freightInvoiceData.billNumber
      }
      const newObject = {
        ledger: info.ledger._id,
        ledgerDisplay: info.ledger.name,
        referenceType: info.referenceType,
        referenceNumber: info.referenceNumber,
        referenceNumberDisplay: billNumber,
        balance: Math.abs(balance),
        amount: info.amount,
        chNumber: null
      }
      crEntryArray.push(newObject)
    } else {
      const newObject = {
        ledger: info.ledger._id,
        ledgerDisplay: info.ledger.name,
        referenceType: "N/A",
        referenceNumber: "N/A",
        referenceNumberDisplay: "N/A",
        balance: info.amount,
        amount: info.amount,
        chNumber: null
      }
      crEntryArray.push(newObject)
    }
  }



  let drEntryArray = []
  for (const info of data.drEntry) {
    info.balance = 0;
    if (info.referenceType === "new") {
      const ledgerData = await ledger.findById(info.ledger);
      const newRefData = await newRef.findById(info.referenceNumber);
      const balance = await getReferenceBalance(ledgerData, info.referenceNumber);
      const newObject = {
        ledger: info.ledger._id,
        ledgerDisplay: info.ledger.name,
        referenceType: info.referenceType,
        referenceNumber: info.referenceNumber,
        referenceNumberDisplay: newRefData.number,
        balance: Math.abs(balance),
        amount: info.amount,
        chNumber: info.chNumber
      }
      drEntryArray.push(newObject)
    }
    else if (info.referenceType === "against") {
      const ledgerData = await ledger.findById(info.ledger);
      const freightInvoiceData = await freightInvoice.findById(info.referenceNumber);
      const balance = await getReferenceBalance(ledgerData, info.referenceNumber);
      const newObject = {
        ledger: info.ledger._id,
        ledgerDisplay: info.ledger.name,
        referenceType: info.referenceType,
        referenceNumber: info.referenceNumber,
        referenceNumberDisplay: freightInvoiceData.billNumber,
        balance: Math.abs(balance),
        amount: info.amount,
        chNumber: info.chNumber
      }
      drEntryArray.push(newObject)
    } else if(info.referenceType === "onAccount"){
      const newObject = {
        ledger: info.ledger._id,
        ledgerDisplay: info.ledger.name,
        referenceType: "onAccount",
        referenceNumber: "N/A",
        referenceNumberDisplay: "N/A",
        balance: info.amount,
        amount: info.amount,
        chNumber: info.chNumber
      }
      drEntryArray.push(newObject)
    }
    else {
      const newObject = {
        ledger: info.ledger._id,
        ledgerDisplay: info.ledger.name,
        referenceType: "N/A",
        referenceNumber: "N/A",
        referenceNumberDisplay: "N/A",
        balance: info.amount,
        amount: info.amount,
        chNumber: info.chNumber
      }
      drEntryArray.push(newObject)
    }
  }
  return res.status(200).send({ data1: data, crEntry: crEntryArray, drEntry: drEntryArray })
})

async function getReferenceBalance(ledgerData, referenceID) {



  try {
    let currentRefDr = 0
    let currentRefCr = 0
    for (j = 0; j < ledgerData.transactions.length; j++) {
      if (ledgerData.transactions[j].reference.rel == referenceID) {
        if (ledgerData.transactions[j].type == "dr") {
          currentRefDr += ledgerData.transactions[j].amount
        } else {
          currentRefCr += ledgerData.transactions[j].amount
        }
      }
    }
    let currrentRefNetBalance = currentRefDr - currentRefCr
    return currrentRefNetBalance
  } catch (err) {
    console.log(err)
    return false
  }


}

Route.post("/accounts/reciepts/edit", async (req, res) => {
  const db = req.dbConnection
  const rvSchema = db.model("reciept-vouchers", recieptVoucher)
  const freightInvoice = db.model("freight-invoices", freightInvoiceSchema)
  const ref = db.model("new-references", newRefSchema)
  const ledger = db.model("ledgers", ledgerSchema)
  const session = await db.startSession()
  session.startTransaction()
  try {

    const { editID, statusCR, chNumber, statusDR, voucherNumber, recieptDate, ledgerCR, referenceTypeCr, referenceNumberCR, amountCr, recievedAmtCr, balanceCr, ledgerDR, referenceTypeDr, referenceNumberDR, amountDr, recievedAmtDr, balanceDr } = req.body

    //form validation
    if (!voucherNumber || !recieptDate || !ledgerCR || !referenceTypeCr || !referenceNumberCR || !amountCr || !recievedAmtCr || !balanceCr || !ledgerDR || !referenceTypeDr || !referenceNumberDR || !amountDr || !recievedAmtDr || !balanceDr) {
      return res.status(400).send({ message: "All fields are required" })
    }
    // converting all non array fields to array
    let ledgerCRArray = Array.isArray(ledgerCR) ? ledgerCR : [ledgerCR]
    let referenceTypeCrArray = Array.isArray(referenceTypeCr) ? referenceTypeCr : [referenceTypeCr]
    let referenceNumberCrArray = Array.isArray(referenceNumberCR) ? referenceNumberCR : [referenceNumberCR]
    let amountCrArray = Array.isArray(amountCr) ? amountCr : [amountCr]
    let recievedAmtCrArray = Array.isArray(recievedAmtCr) ? recievedAmtCr : [recievedAmtCr]
    let balanceCrArray = Array.isArray(balanceCr) ? balanceCr : [balanceCr]
    let ledgerDRArray = Array.isArray(ledgerDR) ? ledgerDR : [ledgerDR]
    let referenceTypeDrArray = Array.isArray(referenceTypeDr) ? referenceTypeDr : [referenceTypeDr]
    let referenceNumberDrArray = Array.isArray(referenceNumberDR) ? referenceNumberDR : [referenceNumberDR]
    let amountDrArray = Array.isArray(amountDr) ? amountDr : [amountDr]
    let recievedAmtDrArray = Array.isArray(recievedAmtDr) ? recievedAmtDr : [recievedAmtDr]
    let balanceDrArray = Array.isArray(balanceDr) ? balanceDr : [balanceDr]
    let statusCRArray = Array.isArray(statusCR) ? statusCR : [statusCR]
    let statusDRArray = Array.isArray(statusDR) ? statusDR : [statusDR]
    let chNumberArray = Array.isArray(chNumber) ? chNumber : [chNumber]
    //sum of dr balance and cr balance should be equal
    const totalCr = recievedAmtCrArray.reduce((a, b) => parseFloat(a) + parseFloat(b), 0)
    const totalDr = recievedAmtDrArray.reduce((a, b) => parseFloat(a) + parseFloat(b), 0)


    if (totalCr != totalDr) {

      session.abortTransaction()
      return res.status(400).send({ message: "Debit and credit balance should be equal" })
    }

    //checking if any new reference which was added previously is now removed and if been removed then we need to first verify if it was used in any other transaction
    const rvData = await rvSchema.findById(editID).session(session)
    for (const data of rvData.crEntry) {
      await removeEntry(db, session, data.ledger, data.transactionID)
    }
    for (const data of rvData.drEntry) {
      await removeEntry(db, session, data.ledger, data.transactionID)
    }

    rvData.crEntry = []
    rvData.drEntry = []
    await rvData.save()

    let drArray = []
    //constructing drArray
    for (i = 0; i < ledgerDRArray.length; i++) {
      drArray.push({
        chNumber: chNumberArray[i],
        ledger: ledgerDRArray[i],
        referenceType: referenceTypeDrArray[i],
        referenceNumber: referenceNumberDrArray[i],
        amount: recievedAmtDrArray[i],
        transactionID: null
      })
    }

    let crArray = []
    //constructing crArray
    for (i = 0; i < ledgerCRArray.length; i++) {
      crArray.push({
        chNumber: null,
        ledger: ledgerCRArray[i],
        referenceType: referenceTypeCrArray[i],
        referenceNumber: referenceNumberCrArray[i],
        amount: recievedAmtCrArray[i],
        transactionID: null
      })
    }

    //new cr transactions
    let crAgainst = [] //used in drTransactions
    for (i = 0; i < ledgerCRArray.length; i++) {
      if (referenceTypeCrArray[i] == "against") {
        const fiData = await freightInvoice.findById(referenceNumberCrArray[i])
        if (fiData) {
          refToLink = "freightInvoice"
        } else {
          refToLink = "new"
        }
      } else if (referenceTypeCrArray[i] == "new") {
        refToLink = "new"
      } else if (referenceTypeCrArray[i] == "onAccount") {
        refToLink = "onAccount"
      }

      if (referenceTypeCrArray[i] == "new") {
        let refData = await findByIdOrNull(ref, referenceNumberCrArray[i])
        if(!refData){
          const newReference = new ref({
            date: recieptDate,
            number: referenceNumberCrArray[i],
            ledger: ledgerCRArray[i],
            amount: recievedAmtCrArray[i],
            reference: {
              type: "reciept",
              rel: rvData._id
            }
          })
          refData = await newReference.save({ session })
        }
        const id = await newEntry(db, session, ledgerCRArray[i], recieptDate, req.user.financialYear, "cr", recievedAmtCrArray[i], "narration", "new", refData._id, [], "reciept", rvData._id)
        crAgainst.push({ ledger: ledgerCRArray[i], transactionID: id })
        crArray[i].referenceNumber = refData._id
      } else {
        const id = await newEntry(db, session, ledgerCRArray[i], recieptDate, req.user.financialYear, "cr", recievedAmtCrArray[i], "narration", refToLink, referenceNumberCrArray[i], [], "reciept", rvData._id)
        crAgainst.push({ ledger: ledgerCRArray[i], transactionID: id })
      }
    }

    //new dr transactions
    let drAgainst = [] //used in crTransactions
    for (i = 0; i < ledgerDRArray.length; i++) {
      if (referenceTypeDrArray[i] == "against") {
        const fiData = await freightInvoice.findById(referenceNumberDrArray[i])
        if (fiData) {
          refToLink = "freightInvoice"
        } else {
          refToLink = "new"
        }
      } else if (referenceTypeDrArray[i] == "new") {
        refToLink = "new"
      } else if (referenceTypeDrArray[i] == "onAccount") {
        refToLink = "onAccount"
      }
      if (referenceTypeDrArray[i] == "new") {
        let refData = await findByIdOrNull(ref, referenceNumberCrArray[i])
        if(!refData){
          const newReference = new ref({
            date: recieptDate,
            number: refData ? refData.number : referenceNumberDrArray[i],
            ledger: ledgerDRArray[i],
            amount: recievedAmtDrArray[i],
            reference: {
              type: "reciept",
              rel: rvData._id
            }
          })
          refData = await newReference.save({ session })
         }
        const id = await newEntry(db, session, ledgerDRArray[i], recieptDate, req.user.financialYear, "dr", recievedAmtDrArray[i], "narration", "new", refData._id, crAgainst, "reciept", rvData._id)
        drAgainst.push({ ledger: ledgerDRArray[i], transactionID: id })
         drArray[i].referenceNumber = refData._id
      } else {
        const id = await newEntry(db, session, ledgerDRArray[i], recieptDate, req.user.financialYear, "dr", recievedAmtDrArray[i], "narration", refToLink, referenceNumberDrArray[i], crAgainst, "reciept", rvData._id)
        drAgainst.push({ ledger: ledgerDRArray[i], transactionID: id })
      }
    }

    //updating against in cr entries
    for (i = 0; i < crAgainst.length; i++) {
      const ledgerData = await ledger.findById(crAgainst[i
      ].ledger).session(session)
      ledgerData.transactions.id(crAgainst[i].transactionID).against = drAgainst
      await ledgerData.save()
    }

    //updating drEntry and crEntry arrays
    for (i = 0; i < ledgerCRArray.length; i++) {
      crArray[i].transactionID = crAgainst[i].transactionID
    }
    for (i = 0; i < ledgerDRArray.length; i++) {
      drArray[i].transactionID = drAgainst[i].transactionID
    }

    //updating reciept voucher
    await rvSchema.findByIdAndUpdate(editID, { drEntry: drArray, crEntry: crArray }, { session })
    await session.commitTransaction() 
    return res.sendStatus(200)




  } catch (err) {
    console.log(err)
    await session.abortTransaction()
    session.endSession()
    return res.sendStatus(500)
  } finally {
    session.endSession()
  }
})

Route.get("/accounts/reciepts/delete", async (req, res) => {

  const db = req.dbConnection
  const rvSchema = db.model("reciept-vouchers", recieptVoucher)
  const session = await db.startSession()
  session.startTransaction()
  try {
    const rvData = await rvSchema.findById(req.query.id).session(session)
    for (const data of rvData.crEntry) {
      await removeEntry(db, session, data.ledger, data.transactionID)
    }
    for (const data of rvData.drEntry) {
      await removeEntry(db, session, data.ledger, data.transactionID)
    }
    await rvData.remove({ session })
    await session.commitTransaction()
    session.endSession()
    return res.sendStatus(200)
  } catch (err) {
    console.log(err)
    await session.abortTransaction()
    session.endSession()
    return res.sendStatus(500)
  }
})


module.exports = Route