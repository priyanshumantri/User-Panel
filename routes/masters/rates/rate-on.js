const express = require("express")
const Route = express.Router()
const roSchema = require("../../../models/masters/rates/rate-on")

Route.get("/masters/rates/rate-on", async(req, res)=> {
    const db = req.dbConnection
    const ro = db.model("rate-on", roSchema)
    const data = await ro.find({})
    res.render("masters/rates/rate-on", {data})
})

Route.post("/masters/rates/rate-on", async(req, res)=> {
    const db = req.dbConnection
    const ro = db.model("rate-on", roSchema)
    
    try {

        const {rateON, unit} = req.body
        const newRateOn = new ro({
            rateON,
            unit
        })

        await newRateOn.save()
        return res.sendStatus(200)

    } catch(err){
        console.log(err)
        res.sendStatus(500)
    }
    
})

Route.post("/masters/rates/rate-on/edit", async(req, res)=> {
    const db = req.dbConnection
    const ro = db.model("rate-on", roSchema)
    
    try {

        const {id, rateON, unit} = req.body
       const roDATA = await ro.findById(id)
       roDATA.rateON = rateON
       roDATA.unit = unit

        await roDATA.save()
        return res.sendStatus(200)

    } catch(err){
        console.log(err)
        res.sendStatus(500)
    }
    
})

Route.post("/masters/rates/rate-on/delete", async(req, res)=> {
    const db = req.dbConnection
    const ro = db.model("rate-on", roSchema)
    
    try {

       const data = await ro.findById(req.body.id)
        if(data.lock !== true){
            await ro.findByIdAndDelete(req.body.id)
            return res.sendStatus(200)
        } else {
            return res.status(400).send({message : "Cannot delete locked data"})
        }
        

    } catch(err){
        console.log(err)
        res.sendStatus(500)
    }
})

module.exports = Route