const express = require("express")
const Route = express.Router()
const goodsDescriptionSchema = require("../../models/masters/goodsDescription")


Route.get("/masters/goods-description", (req, res)=> {
    const db = req.dbConnection
    const goodsDescriptionModule = db.model("goods-description", goodsDescriptionSchema)
    goodsDescriptionModule.find({}).then((data)=> {
        res.render("masters/goodsDescription", {data : data})
    }).catch((error)=> {
        console.error(error)
        res.sendStatus(500)
    })
})

Route.post("/masters/goods-description", async (req, res)=> {
    const db = req.dbConnection
    const goodsDescriptionModule = db.model("goods-description", goodsDescriptionSchema)
   try {
    const {goodsDescription} = req.body
    if(!goodsDescription) {
        res.status(400).send({message : "Goods Description is a required field"})
    } else {

        const existingGoodsDescription = await goodsDescriptionModule.findOne({goodsDescription : goodsDescription})
        if(existingGoodsDescription) {
            res.status(400).send({message : "Goods Description With These Name Already Exists"})
        } else {
            const newGoodsDescription = new goodsDescriptionModule({
                goodsDescription : goodsDescription
            })

            newGoodsDescription.save().then(()=> {
                res.sendStatus(200)
            })
        }
    }
   } catch(error) {
    console.error(error)
    res.sendStatus(500)
} 
})

Route.post("/masters/goods-description/edit", async(req, res)=> {
    const db = req.dbConnection
    const goodsDescriptionModule = db.model("goods-description", goodsDescriptionSchema)
    try { 
        const goodsDescription = req.body.editGoodsDescription
    if(!goodsDescription) {
        res.status(400).send({message : "Goods Description is required"})
    } else {
        const existingGoodsDescription = await goodsDescriptionModule.findOne({goodsDescription : goodsDescription})
        if(existingGoodsDescription && existingGoodsDescription.id !== req.body.id) {
            res.status(400).send({message : "Goods Description With That Name Already Exists"})
        } else {
            goodsDescriptionModule.findByIdAndUpdate(req.body.id, {goodsDescription : goodsDescription}).then(()=> {
                res.sendStatus(200)
            })
        }
    }
    } catch(error) {
        console.error(error)
        res.sendStatus(500)
    }
})

Route.post("/masters/goods-description/delete", (req, res)=> {
    const db = req.dbConnection
    const goodsDescriptionModule = db.model("goods-description", goodsDescriptionSchema)
    try {

        goodsDescriptionModule.findByIdAndDelete(req.body.id).then(()=> {
            res.sendStatus(200)
        })

    } catch(error) {
        console.error(error)
        res.sendStatus(500)
    }
})

module.exports = Route