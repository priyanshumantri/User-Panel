const express = require("express")
const Route = express.Router()
const mopSchema= require("../../models/masters/method-of-packaging")

Route.get("/masters/method-of-packaging", (req, res)=> {
    const db = req.dbConnection
    const mop = db.model("method-of-packaging", mopSchema)
    mop.find({}).then((data)=> {
        res.render("masters/method-of-packaging", {data : data})
    })
})

Route.post("/masters/method-of-packaging/new", async (req, res)=> {
    const db = req.dbConnection
    const mop = db.model("method-of-packaging", mopSchema)
    const existingMOP = await mop.findOne({methodOfPackaging : req.body.methodOfPackaging})
    if(existingMOP) {
        return res.status(400).send({message : "Methods of Packaging Already Exists"})
    } else {
        const newPackaging = new mop({
            methodOfPackaging : req.body.methodOfPackaging
        })
    
        newPackaging.save().then(()=> {
           return res.sendStatus(200)
        })
    }

    
})


Route.post("/masters/method-of-packaging/delete", (req, res)=> {
    const db = req.dbConnection
    const mop = db.model("method-of-packaging", mopSchema)
    mop.findByIdAndDelete(req.body.id).then(()=> {
        res.sendStatus(200)
    })
})

Route.post("/masters/method-of-packaging/edit", async (req, res)=> {
    const db = req.dbConnection
    const mop = db.model("method-of-packaging", mopSchema)
    mop.findOne({methodOfPackaging : req.body.editMethodOfPackaging}, (err, data)=> {
        if(err) {
            console.error(error)
            res.sendStatus(500)
        } else if(data && data.id !== req.body.id) {
            res.status(400).send({message : "Method of Packaging Already Exists"})
        } else {
            mop.findByIdAndUpdate(req.body.id, {methodOfPackaging : req.body.editMethodOfPackaging}).then(()=> {
                res.sendStatus(200)
            })
        }
    })
})

module.exports = Route