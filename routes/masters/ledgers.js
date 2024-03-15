const express = require("express")
const Route = express.Router()
const ledgersSchema = require("../../models/masters/ledgers")
const groupsSchema = require("../../models/masters/groups")
const statesSchema = require("../../models/masters/locations/states")
const citiesSchema = require("../../models/masters/locations/cities")
const newEntry = require("../../custom_modules/accounts/newEntry")
const removeEntry = require("../../custom_modules/accounts/removeEntry")
const newRefSchema = require("../../models/accounts/new")
const{ validateGSTNumber, updateGST, updateGSTUsedFalse} = require("../../custom_modules/validations/gst")
const { verifyEmail, updateEmail, updateEmailUsedFalse } = require("../../custom_modules/validations/email")
const { validateMobile, updateMobile, updateMobileUsedFalse } = require("../../custom_modules/validations/mobile")
const validatePANNumber = require("../../custom_modules/validations/pan")
Route.get("/masters/ledgers", async (req, res) => {
    const db = req.dbConnection
    const ledgers = db.model("ledgers", ledgersSchema)
    const groups = db.model("groups", groupsSchema)
    const states = db.model("states", statesSchema)
    const cities = db.model("cities", citiesSchema)
    const groupData = await groups.find({})
    const stateData = await states.find({})
    const cityData = await cities.find({})
    ledgers.find({}).populate("group").then((data) => {
        res.render("masters/ledgers/manage", { data: data, groupData: groupData, stateData: stateData, cityData: cityData })

    })

})



const getMessage = async (groupId, groupsModel) => {
    const groupData = await groupsModel.findById(groupId);

    const validGroupNames = ["fixedassets", "currentassets", "loans&liability", "purchaseaccount", "salesaccount", "sundrydebtors", "sundrycreditor", "bankaccount", "bankod", "cashinhand", "salesaccount", "duties&taxes", "lorryhire(creditors)", "directexpenses", "indirectexpenses", "directincome", "indirectincome", "currentliability", "capitalaccount", "investments"];

    let stringWithoutSpaces = groupData.name.replace(/\s/g, '');
    const finalValue = stringWithoutSpaces.toLowerCase();

    if (validGroupNames.includes(finalValue)) {
        if (finalValue === "sundrydebtors" || finalValue === "sundrycreditor") {
            return "superhigh"
        } else if (finalValue === "fixedassets" || finalValue === "loans&liability" || finalValue === "capitalaccount" || finalValue === "currentAssets" || finalValue === "purchaseaccount" || finalValue === "salesaccount" || finalValue === "investments" || finalValue === "lorryhire(creditors)" || finalValue === "currentliability") {
            return "high";
        } else if (finalValue === "bankaccount" || finalValue === "bankod") {
            return "medium";
        } else if (finalValue === "cashinhand" || finalValue === "salesaccount" || finalValue === "duties&taxes" || finalValue === "directexpenses" || finalValue === "indirectincome" || finalValue === "indirectexpenses" || finalValue === "directincome") {
            return "low";
        }
    }

    if (groupData.under && groupData.under !== "primary") {
        return await getMessage(groupData.under, groupsModel);
    }

    return null;
};

Route.get("/masters/ledgers/get-fields", async (req, res) => {
    const db = req.dbConnection;
    const groups = db.model("groups", groupsSchema);
    const groupId = req.query.id;

    const message = await getMessage(groupId, groups);

    if (message) {
        return res.status(200).send({ message });
    } else {
        // Handle the case where no valid message is found
        return res.status(200).send({ message: "No valid message found" });
    }
});



Route.post("/masters/ledgers/new", async (req, res) => {
    const db = req.dbConnection
    const ledgers = db.model("ledgers", ledgersSchema)
    const groups = db.model("groups", groupsSchema)
    const { entityType, fieldType, ledgerName, ledgerNameMid, ledgerNameLow, group, personName, state, city, bankCity, bankState, mobile, email, address, PAN, gstNumber, aliasName, openingBalance, openingBalanceType, accountNumber, ifsc, bankBranch } = req.body
    const session = await db.startSession()
    try {
        session.startTransaction()
        let ledgerData
        if (!group) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select A Group" })
        }
        const groupData = await groups.findById(group).session(session)

        if (fieldType == "superhigh" || fieldType == "high") {
            
                const mobileValidation = await validateMobile(db, session, mobile, "ledgers");
                if (mobileValidation.status === false) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: mobileValidation.message })
                }
       

       
                const emailValidation = await verifyEmail(db, session, email, "ledgers");
                if (emailValidation.status === false) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: emailValidation.message })
                }
   

     
                const gstValidation = await validateGSTNumber(req.company, db, session, gstNumber, "ledgers");
                if (gstValidation.error) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: "Invalid GST Number" })
                }
    

                const panValidation = await validatePANNumber(db, session, PAN, "ledgers");
                if (panValidation.error) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: "Invalid PAN Number" })
                }
  


        }
        //creating ledger for superhigh
        if (fieldType === "superhigh") {
            if (!entityType || !ledgerName || !aliasName || !address || !state || !city || !PAN || !openingBalance || !openingBalanceType) {
                await session.abortTransaction()
                return res.status(400).send({ message: "Please fill all Required Fields" })
            }
            if (!gstNumber && entityType === "registered") {
                await session.abortTransaction()
                return res.status(400).send({ message: "Please Enter A Valid GST Number" })
            }
            const newLedgers = new ledgers({
                name: ledgerName,
                entityType: entityType,
                aliasName: aliasName,
                group: groupData._id,
                contactPerson: personName,
                email: email,
                state: state,
                city: city,
                mobile: mobile,
                address: address,
                openingBalance: {
                    amount: openingBalance,
                    type: openingBalanceType,
                    fy: req.user.financialYear
                },
                taxation: {
                    GST: gstNumber,
                    PAN: PAN
                }
            })

            ledgerData = await newLedgers.save({ session })
        }
        //creating ledger for high
        else if (fieldType == "high") {
            if (!ledgerName || !mobile || !address) {
                await session.abortTransaction()
                return res.status(400).send({ message: "Please fill all Required Fields" })
            }
            const newLedgers = new ledgers({
                name: ledgerName,
                aliasName: ledgerName,
                group: groupData._id,
                contactPerson: personName,
                email: email,
                state: state,
                city: city,
                mobile: mobile,
                address: address,
                openingBalance: {
                    amount: openingBalance,
                    type: openingBalanceType,
                    fy: req.user.financialYear
                },
                taxation: {
                    PAN: PAN
                }
            })

            ledgerData = await newLedgers.save({ session })
        }
        //creating ledger for medium
        else if (fieldType == "medium") {
            if (!ledgerNameMid || !accountNumber || !ifsc || !bankBranch) {
                await session.abortTransaction()
                return res.status(400).send({ message: "Please fill all Required Fields" })
            }
            const newLedgers = new ledgers({
                name: ledgerNameMid,
                aliasName: ledgerNameMid,
                group: groupData._id,
                openingBalance: {
                    amount: openingBalance,
                    type: openingBalanceType,
                    fy: req.user.financialYear
                },
                accountNumber: accountNumber,
                ifsc: ifsc,
                bankBranch: bankBranch,
                state: bankState,
                city: bankCity
            })

            ledgerData = await newLedgers.save({ session })


        }
        //creating ledger for low
        else if (fieldType == "low") {
            if (!ledgerNameLow) {
                await session.abortTransaction()
                return res.status(400).send({ message: "Please fill all Required Fields" })
            }
            const newLedgers = new ledgers({
                name: ledgerNameLow,
                aliasName: ledgerNameLow,
                group: groupData._id,
                openingBalance: {
                    amount: openingBalance,
                    type: openingBalanceType,
                    fy: req.user.financialYear
                }
            })

            ledgerData = await newLedgers.save({ session })
        }

        if (parseFloat(openingBalance > 0)) {
            const date = new Date();
            //converting date to dd-mm-yyyy format
            const formattedDate = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear()
            const id = await newEntry(db, session, ledgerData._id, formattedDate, req.user.financialYear, onAccountType, onAccount, "narration", "onAccount", null, [], "openingBalance", null, null, "openingBalance", null)
            ledgerData.openingBalance.transactionID = id;
            await ledgerData.save();
        }

        if (fieldType == "superhigh" || fieldType == "high") {
            if(gstNumber !== "") {
                await updateGST(db, session, gstNumber);
            }
            if(email !== "") {
                await updateEmail(db, session, email);
            }
            if(mobile !== "") {
                await updateMobile(db, session, mobile);
            }
        }
        await session.commitTransaction()
        return res.sendStatus(200)



    }

    catch (error) {
        await session.abortTransaction()
        console.log(error)
        res.sendStatus(500)
    } finally {
        session.endSession()
    }
})

//Add Conditions later from preventing cleints from getting deleted based on requirements as and when

Route.post("/masters/ledgers/delete", async (req, res) => {
    const db = req.dbConnection
    const ledgers = db.model("ledgers", ledgersSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const ledgerData = await ledgers.findById(req.body.id).session(session)
        const filtered = ledgerData.transactions.filter((element) => element.reference.at === "openingBalance" && element.reference.type !== "onAccount")
        if (filtered.length > 0) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Ledger Cannot Be Deleted As It Has Transactions" })
        }
        if (ledgerData.brokerLedger) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Ledger Cannot Be Deleted As It Is Linked to broker / owner" })
        }
        if (ledgerData.defaultLedger) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Ledger Cannot Be Deleted As It Is A Default Ledger" })
        }


        if (ledgerData.email) {
            const done = await updateEmailUsedFalse(db, session, ledgerData.email)
            if (!done) {
                await session.abortTransaction()
                return res.status(500).send({ message: "Something Went Wrong, Please Try Again Later" })
            }
        }
        if (ledgerData.mobile) {
            const done = await updateMobileUsedFalse(db, session, ledgerData.mobile)
            if (!done) {
                await session.abortTransaction()
                return res.status(500).send({ message: "Something Went Wrong, Please Try Again Later" })
            }
        }
        if (ledgerData.taxation.GST) {
            const done = await updateGSTUsedFalse(db, session, ledgerData.taxation.GST)
            if (!done) {
                await session.abortTransaction()
                return res.status(500).send({ message: "Something Went Wrong, Please Try Again Later" })
            }
        }


        await ledgerData.deleteOne()
        await session.commitTransaction()
        return res.sendStatus(200)
    } catch (err) {
        await session.abortTransaction()
        console.log(err)
        return res.sendStatus(500)
    } finally {
        session.endSession()
    }

})

Route.get("/masters/ledgers/edit", async (req, res) => {
    const db = req.dbConnection
    const ledger = db.model("ledgers", ledgersSchema)
    const groups = db.model("groups", groupsSchema)
    const ledgerData = await ledger.findById(req.query.id)
    const message = await getMessage(ledgerData.group, groups);
    res.status(200).send({ ledgerData, message })
})


Route.post("/masters/ledgers/edit", async (req, res) => {
    const db = req.dbConnection
    const ledgers = db.model("ledgers", ledgersSchema)
    const { entityType, aliasName, fieldType, editID, ledgerName, ledgerNameMid, ledgerNameLow, group, personName, state, city, bankCity, bankState, mobile, email, address, PAN, gstNumber, openingBalance, openingBalanceType, accountNumber, ifsc, bankBranch } = req.body
    const session = await db.startSession()
    try {
        session.startTransaction()
        const ledgerData = await ledgers.findById(editID).session(session)
        //setting old email and mobile used to false
        if (ledgerData.email.length > 0) {
            const done = await updateEmailUsedFalse(db, session, ledgerData.email)
            if (!done) {
                await session.abortTransaction()
                return res.status(500).send({ message: "Something Went Wrong, Please Try Again Later" })
            }
        }
        if (ledgerData.mobile.length > 0) {
            const done = await updateMobileUsedFalse(db, session, ledgerData.mobile)
            if (!done) {
                await session.abortTransaction()
                return res.status(500).send({ message: "Something Went Wrong, Please Try Again Later" })
            }
        }
        if (ledgerData.taxation.GST) {
            const done = await updateGSTUsedFalse(db, session, ledgerData.taxation.GST)
            if (!done) {
                await session.abortTransaction()
                return res.status(500).send({ message: "Something Went Wrong, Please Try Again Later" })
            }
        }




        //updating new email and mobile in centralised tables
        if (fieldType == "superhigh" || fieldType == "high") {

                const mobileValidation = await validateMobile(db, session, mobile, "ledgers");
                if (mobileValidation.status === false) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: mobileValidation.message })
                }
        

       
                const emailValidation = await verifyEmail(db, session, email, "ledgers");
                if (emailValidation.status === false) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: emailValidation.message })
                }
        
        }


       
        if (fieldType === "superhigh") {
            if (!entityType || !ledgerName || !aliasName || !address || !state || !city || !PAN || !openingBalance || !openingBalanceType) {
                console.log(req.body)
                await session.abortTransaction()
                return res.status(400).send({ message: "Please fill all Required Fields" })
            }
            console.log(req.body)
            console.log(ledgerData)
            ledgerData.taxation.GST = gstNumber
            ledgerData.aliasName = aliasName
            ledgerData.entityType = entityType
            await ledgerData.save()
        }
        if (fieldType === "low") {
            if (!ledgerNameLow) {
                await session.abortTransaction()
                return res.status(400).send({ message: "Please fill all Required Fields" })
            }
            ledgerData.name = ledgerNameLow
            ledgerData.group = group
            ledgerData.openingBalance.amount = openingBalance
            ledgerData.openingBalance.type = openingBalanceType

            await ledgerData.save()
        } else if (fieldType === "medium") {
            if (!ledgerNameMid || !accountNumber || !ifsc || !bankBranch) {
                await session.abortTransaction()
                return res.status(400).send({ message: "Please fill all Required Fields" })
            }
            ledgerData.name = ledgerNameMid
            ledgerData.group = group
            ledgerData.openingBalance.amount = openingBalance
            ledgerData.openingBalance.type = openingBalanceType
            ledgerData.accountNumber = accountNumber
            ledgerData.ifsc = ifsc
            ledgerData.bankBranch = bankBranch
            ledgerData.state = bankState
            ledgerData.city = bankCity
            await ledgerData.save()
        }
        else if (fieldType === "high" || fieldType === "superhigh") {
            if (!ledgerName || !address || !state || !city || !PAN || !openingBalance || !openingBalanceType) {
                await session.abortTransaction()
                res.status(400).send({ message: "Please fill all Required Fields" })
            }
            ledgerData.name = ledgerName
            ledgerData.group = group
            ledgerData.contactPerson = personName
            ledgerData.email = email
            ledgerData.state = state
            ledgerData.city = city
            ledgerData.mobile = mobile
            ledgerData.address = address
            ledgerData.openingBalance.amount = openingBalance
            ledgerData.openingBalance.type = openingBalanceType
            ledgerData.taxation.PAN = PAN
            await ledgerData.save()
        }

        const found = ledgerData.transactions.find((element) => element.reference.forV === "openingBalance" && ledgerData.openingBalance.transactionID == element._id.toString())
        if (found) {
            found.amount = openingBalance;
            found.type = openingBalanceType;
            await ledgerData.save()

        } else {
            const date = ledgerData.timestamp ? new Date(ledgerData.timestamp) : new Date();
            //converting date to dd-mm-yyyy format
            const formattedDate = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear()
            const id = await newEntry(db, session, ledgerData._id, formattedDate, req.user.financialYear, openingBalanceType, openingBalance, "narration", "onAccount", null, [], "openingBalance", null, null, "openingBalance", 0)
            ledgerData.openingBalance.transactionID = id;


            await ledgerData.save();

        }


        if (fieldType == "superhigh" || fieldType == "high") {
            if(gstNumber !== "") {
                await updateGST(db, session, gstNumber);
            }
            if(email !== "") {
                await updateEmail(db, session, email);
            }
            if(mobile !== "") {
                await updateMobile(db, session, mobile);
            }
        }
        await session.commitTransaction()
        return res.sendStatus(200)

    } catch (error) {
        await session.abortTransaction()
        console.error(error)
        res.sendStatus(500)
    } finally {
        session.endSession()
    }
})

Route.get("/masters/ledgers/get-opening-balance", async (req, res) => {
    const db = req.dbConnection
    const ledger = db.model("ledgers", ledgersSchema)
    const ledgerData = await ledger.findById(req.query.id)
    const newM = db.model("new-references", newRefSchema)
    const transactions = await Promise.all(ledgerData.transactions.filter((element) => element.reference.at === "openingBalance" && element.reference.type !== "onAccount").map(async (element) => {

        const data = await newM.findById(element.reference.rel);
        return {
            date: element.date,
            amount: element.amount,
            type: element.type,
            id: element.reference.rel,
            due: element.due,
            name: data.number
        };
    }));
    return res.status(200).send({ _id: ledgerData._id, name: ledgerData.name, openingBalance: ledgerData.openingBalance.amount, openingBalanceType: ledgerData.openingBalance.type, transactions })
})

Route.post("/masters/ledgers/set-opening-balance", async (req, res) => {
    const db = req.dbConnection
    const ledger = db.model("ledgers", ledgersSchema)
    const newM = db.model("new-references", newRefSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const { status, transactionID, ledgerID, refDate, refName, refDue, refAmt, refType, onAccount, onAccountType, total, netBalance } = req.body

        const refDateArray = Array.isArray(refDate) ? refDate : [refDate]
        const refNameArray = Array.isArray(refName) ? refName : [refName]
        const refAmtArray = Array.isArray(refAmt) ? refAmt : [refAmt]
        const refTypeArray = Array.isArray(refType) ? refType : [refType]
        const refDueArray = Array.isArray(refDue) ? refDue : [refDue]
        const statusArray = Array.isArray(status) ? status : [status]
        const transactionIDArray = Array.isArray(transactionID) ? transactionID : [transactionID]
        if (refDateArray.length === 0 || refNameArray.length === 0 || refAmtArray.length === 0 || refTypeArray.length === 0 || refDueArray.length === 0) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Enter Atleast One Reference" })
        }

        for (i = 0; i < refDateArray.length; i++) {
            if (!refDateArray[i] || !refNameArray[i] || !refAmtArray[i] || !refTypeArray[i] || !refDueArray[i]) {
                await session.abortTransaction()
                return res.status(400).send({ message: "Please Fill All Fields" })
            }
        }

        //remove old entries except onAccount
        const ledgerData = await ledger.findById(ledgerID).session(session)
        const oldEntries = await ledgerData.transactions.filter((element) => element.reference.at === "openingBalance" && element.reference.type !== "onAccount")
        for (i = 0; i < oldEntries.length; i++) {
            await removeEntry(db, session, ledgerID, oldEntries[i]._id)
        }

        for (i = 0; i < refAmtArray.length; i++) {

            let refData
            if (statusArray[i] === "old") {
                refData = await newM.findById(transactionIDArray[i])
                refData.date = refDateArray[i]
                refData.number = refNameArray[i]
                refData.amount = refAmtArray[i]
                await refData.save()

            } else {
                const newRef = new newM({
                    date: refDateArray[i],
                    ledger: ledgerID,
                    primaryLedger: null,
                    number: refNameArray[i],
                    amount: refAmtArray[i],
                    reference: {
                        type: "openingBalance",
                        rel: null
                    }
                })

                refData = await newRef.save({ session });
            }

            //new entry
            const id = await newEntry(db, session, ledgerID, refDateArray[i], req.user.financialYear, refTypeArray[i].toLowerCase(), refAmtArray[i], "narration", "new", refData._id, [], "openingBalance", null, null, "openingBalance", refDueArray[i])
        }

        if (parseFloat(onAccount)) {
            const ledgerData = await ledger.findById(ledgerID).session(session)
            const found = ledgerData.transactions.find((element) => element.reference.forV === "openingBalance" && ledgerData.openingBalance.transactionID == element._id.toString())
            if (found) {
                found.amount = parseFloat(onAccount);
                found.type = onAccountType.toLowerCase();
                await ledgerData.save()
            } else {
                const date = ledgerData.timestamp ? new Date(ledgerData.timestamp) : new Date();
                //converting date to dd-mm-yyyy format
                const formattedDate = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear()
                const id = await newEntry(db, session, ledgerID, formattedDate, req.user.financialYear, onAccountType, onAccount, "narration", "onAccount", null, [], "openingBalance", null, null, "openingBalance", null)
                ledgerData.openingBalance.transactionID = id;
                await ledgerData.save();
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

})

Route.get("/masters/get-gst-data", async (req, res) => {
    const db = req.dbConnection;
    const session = await db.startSession();
    session.startTransaction();
    const data = await validateGSTNumber(req.company, db, session, req.query.gstNumber.toUpperCase(), "ledgers");
    if (!data.error) {
        await session.commitTransaction();
       return res.status(200).send({address:  data.address,state : data.state,name :  data.name,pan: data.pan });
    } else {
        await session.abortTransaction();
        return res.status(400).send({ message: data.message });
    }
})


module.exports = Route