const express = require("express")
const Route = express.Router()
const fySchema = require("../../models/financialYear")
const branchSchema = require("../../models/masters/locations/branch")
const godownSchema = require("../../models/masters/locations/godowns")
const seriesSchema = require("../../models/series")
const getCurrentFinancialYear = require("../../custom_modules/financial-year")

Route.get("/settings/series-assign", async (req, res) => {
    const db = req.dbConnection
    const branches = db.model("branches", branchSchema)
    const godown = db.model("godowns", godownSchema)
    const fy = db.model("financial-years", fySchema)
    const branchData = await branches.find({})
    const fyData = await fy.findById(req.user.financialYear).populate({path : "seriesAssigned.branch"}).populate({path : "seriesAssigned.godown"})
    const seriesData = fyData.seriesAssigned
    res.render("companySettings/seriesAssign", { branchData: branchData, seriesData: seriesData })
})

Route.get("/settings/series-assign/get-godown", async (req, res) => {
    const db = req.dbConnection
    const godowns = db.model("godowns", godownSchema)
    const godownData = await godowns.find({ branch: req.query.id })
    try {
        if (godownData.length > 0) {
            return res.status(200).send(godownData)
        } else {
            return res.status(400).send({ message: "NO GODOWNS ADDED FOR THIS BRANCH" })
        }
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

Route.post("/settings/series-assign/new", async (req, res) => {
    const db = req.dbConnection
    const fy = db.model("financial-years", fySchema)
    const { assignFor, branch, godown, forValue, from, to } = req.body

    try {

        if ((!assignFor || !branch || !forValue || !from || !to) || (assignFor === "godown" && !godown)) {
            
            return res.status(400).send({ message: "Please Fill All Required Fields" })

        }

        // now we will check if recieved values are not if not we convert them to array
        const fromArray = Array.isArray(from) ? from : [from]
        const toArray = Array.isArray(to) ? to : [to]
        const forValueArray = Array.isArray(forValue) ? forValue : [forValue]

        // now we will check if all the arrays are of same length
        if (fromArray.length !== toArray.length || fromArray.length !== forValueArray.length) {
            return res.status(400).send({ message: "Please Fill All Required Fields" })
        }

        // now we will check if all the values are numbers
        const fromArrayNumber = fromArray.every((element) => !isNaN(element))
        const toArrayNumber = toArray.every((element) => !isNaN(element))
        if(!fromArrayNumber || !toArrayNumber) {
            return res.status(400).send({ message: "Please Fill All Required Fields" })
        }

        // now we will check if all the values are positive
        const fromArrayPositive = fromArray.every((element) => element >= 0)
        const toArrayPositive = toArray.every((element) => element >= 0)
        if(!fromArrayPositive || !toArrayPositive) {
            return res.status(400).send({ message: "Please Fill All Required Fields" })
        }


        // now we will check if range of from and to dont overlap for same forValue
        for(i=0; i<forValueArray.length; i++) {
            for(j=0; j<forValueArray.length; j++) {
                if(i !== j && forValueArray[i] === forValueArray[j]) {
                    if((fromArray[i] >= fromArray[j] && fromArray[i] <= toArray[j]) || (toArray[i] >= fromArray[j] && toArray[i] <= toArray[j])) {
                        return res.status(400).send({ message: "Please Assign Appropriate Series" })
                    }
                }
            }
        }



        // now we will check if recieved from and array dont conincide with any existing series with same for in db
        const seriesData2 = await fy.findOne({_id : req.user.financialYear})
        if(seriesData2) { 
            for(i=0; i<seriesData2.seriesAssigned.length; i++) {
                for(j=0; j<fromArray.length; j++) {
                    if(seriesData2.seriesAssigned[i].for === forValueArray[j]) {
                        if((fromArray[j] >= seriesData2.seriesAssigned[i].start && fromArray[j] <= seriesData2.seriesAssigned[i].end) || (toArray[j] >= seriesData2.seriesAssigned[i].start && toArray[j] <= seriesData2.seriesAssigned[i].end)) {
                            return res.status(400).send({ message: "Some of The Series Already Assigned to Another Branch / Godown" })
                        }
                    }
                }
            }
         }

        // now we will save new series assigned in db
            let locationVal = "branch"
            if(assignFor === "godown") { 
                locationVal = "godown"
             }

             let godownVal = null
                if(assignFor === "godown") { 
                    godownVal = godown
                 }

          
            const fyDATA = await fy.findOne({ _id : req.user.financialYear })
            for(i=0; i<fromArray.length; i++) {
               const newObject = {
                    location: locationVal,
                    branch : branch,
                    godown : godownVal,
                    for: forValueArray[i],
                    start: fromArray[i],
                    end: toArray[i],
                    balance: toArray[i] - fromArray[i] + 1,
                    active: true
                } 
          fyDATA.seriesAssigned.push(newObject)
          await fyDATA.save()
            }

            
            return res.sendStatus(200)
    

        

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }

})

Route.post("/settings/series-assign/delete", async (req, res) => {
    try {
        const db = req.dbConnection
        const fy = db.model("financial-years", fySchema)

        const fyDATA = await fy.findOne({ financialYear: getCurrentFinancialYear() })
        const filtered = fyDATA.seriesAssigned.find((element) => element.id === req.body.id)
        if ((filtered.end - filtered.start + 1) !== filtered.balance) {
            return res.status(400).send({ message: "This Series is Used So Cant Be Deleted" })
        } else {
            fyDATA.seriesAssigned.pull(filtered)
            await fyDATA.save()
            return res.sendStatus(200)
        }
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }


})


Route.post("/settings/series-assign/stop", async (req, res) => {
    try {
        const db = req.dbConnection
        const fy = db.model("financial-years", fySchema)

        const fyDATA = await fy.findOne({ _id: req.user.financialYear })
        const filtered = fyDATA.seriesAssigned.find((element) => element.id === req.body.id)
        if(!filtered) {
            return res.status(400).send({ message: "NO Series Found" })
        }
            filtered.active = false
            await fyDATA.save()
            return res.sendStatus(200)
     
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }


})

Route.post("/settings/series-assign/start", async (req, res) => {
    try {
        const db = req.dbConnection
        const fy = db.model("financial-years", fySchema)

        const fyDATA = await fy.findOne({ _id: req.user.financialYear })
        const filtered = fyDATA.seriesAssigned.find((element) => element.id === req.body.id)
        if(!filtered) {
            return res.status(400).send({ message: "NO Series Found" })
        }
            filtered.active = true
            await fyDATA.save()
            return res.sendStatus(200)
     
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }

})

Route.get("/settings/series-assign/edit", async (req, res) => { 
    console.log(req.query)
 })

module.exports = Route