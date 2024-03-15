const express = require("express")
const Route = express.Router()
const company = require("../../models/settings/company")
const upload = require("../../configs/multer")
const {activityLogger} = require("../../custom_modules/activityLogger")

Route.get("/settings/overview", (req, res)=> {
    company.findOne({}, (err, data)=> {
        if(err) {
            
        } else {
            
            res.render("companySettings/overview", {companyData : data})
        }
    })
})

Route.post("/settings/overview", upload.single('companyLogo'), async (req, res) => {
   try {

    const {companyName, website, address, email, pan} = req.body

    if(!companyName || !website || !address || !email || !pan) {
        req.flash("notdone", "done")
        res.redirect("/settings/overview")
    }

    const companyToUpdate = await  company.findOne({})

    companyToUpdate.companyName = companyName
    companyToUpdate.companyAddress = address
    companyToUpdate.companyEmail = email
    companyToUpdate.websiteURL = website
    companyToUpdate.panCard = pan

    if(req.file) {
        companyToUpdate.companyLogo = req.file.filename
    }

    await companyToUpdate.save()
    req.flash("success", "Company Details Updated Successfully")
    res.redirect("/settings/overview")
   } catch(err) {
    console.log(err)
    res.sendStatus(500)
}
});
module.exports = Route