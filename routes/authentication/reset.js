const express = require("express")
const Route = express.Router()
const user = require("../../models/authentication/user")
const nodemailer = require("nodemailer")
const transporter = require("../../configs/nodemailer")
const bcrypt = require("bcrypt")
const ejs = require("ejs")
let time = new Date()
const reset = require("../../models/authentication/reset")
const communication = require("../../models/settings/communication")
const company = require("../../models/settings/company")

Route.get("/reset-password", (req, res) => {
    res.render("authentication/reset")
})



Route.post("/reset-password", (req, res) => {
    user.findOne({ email: req.body.email }, function (err, data) {
        if (err) {
            console.log(err)
        }
        if (data) {

            bcrypt.hash(req.body.email, 1, async function (err, emailToken) {


                const expiryTimeRaw = time.toISOString()
                bcrypt.hash(expiryTimeRaw, 10, (err, expiryTime)=> {

                    const newReset = new reset({
                        token: emailToken,
                        tokenTime: expiryTimeRaw,
                        tokenUsed: false,
                        user: data.id
                    })
                    newReset.save().then((savedData) => {
                        user.findOneAndUpdate({ email: req.body.email }, { $push: { resetPassword: savedData } }, (err, data)=> {
                            if (err) {
                                console.log(err)
                            } else {
                                company.findOne({}, (err, companyData)=> {
                                    if(err) {
                                        res.sendStatus(500)
                                        console.log(err)
                                    } else {

                                        communication.findOne({}, async function (err, communicationData) {
                                            if(err) {
                                                console.log(err)
                                            } else {
                                                const url = "http://" + req.headers.host + "/reset/" + req.body.email + "?emailToken=" + emailToken + "&expiry=" + expiryTime
                                                const data = await ejs.renderFile(__dirname + "/templates/password-reset.ejs", { url: url, company : companyData });
                                                const mainOptions = {
                                                    from: communicationData.authProcess,
                                                    to: req.body.email,
                                                    subject: 'Password Reset',
                                                    html: data
                                                };
                                                transporter.sendMail(mainOptions, (err, info) => {
                                                    if (err) {
                                                        console.log(err);
                                                    } else {
                                                        res.render("authentication/reset", { success: "Password Reset Link Sent" })
                                                    }
                                                });
                                            }
                                        })
                                    }
                                })
                               
                            }
                        })
                    })

                })
            })
        }
        if (!data) {
            res.render("authentication/reset", { noEmail: "No Email Found", email: req.body.email })
        }
    })
})

Route.get("/reset/:email", (req, res) => {

    reset.findOne({ token: req.query.emailToken }, (err, data) => {
        if (err) {
            console.log(err)
        } else if (!data) {
            res.send(404)
        } else {

            //BOTH TOKEN AND EXPIRY ARE VERIFIED HERE, NOW WE CHECK EXPIRY

            bcrypt.compare(data.tokenTime, req.query.expiry, (err, result) => {
                if (err) {
                    console.log(err)
                } else {

                    if(result === true) {
                        if ((new Date() - new Date(data.tokenTime)) > 60 * 60 * 1000) {
                            res.sendStatus(404)
                        } else {
                            user.findOne({ email: req.params.email }, (err, data) => {
                                if (err) {
                                    console.log(err)
                                }
                                if (data) {
    
                                    bcrypt.compare(req.params.email, req.query.emailToken, (err, result) => {
                                        if (err) {
                                            console.log(err)
                                        }
                                        if (result === true) {
                                            res.render("authentication/newpassword", { email: req.params.email, emailToken: req.query.emailToken })
                                        }else  {
                                            res.sendStatus(404)
                                        }
                                    })
    
                                }
                                if (!data) {
                                    res.sendStatus(404)
                                }
                            })
                        }
                    } else {
                        res.sendStatus(404)
                    }
                   
                }
            })

        }
    })

})

Route.post("/password-reset", (req, res) => {

    if (req.body.password !== req.body.confirmPassword) {

        res.render("authentication/newpassword", { email: req.body.email, emailToken: req.body.emailToken, error: "Passwords Do Not Match" })
    }


    user.findOne({ email: req.body.email }, (err, data) => {
        if (err) {
            console.log(err)
        }
        if (data) {
            bcrypt.compare(req.body.password, data.password, (err, result) => {
                if (err) {
                    console.log(err)
                }
                if (result) {

                    res.render("authentication/newpassword", { email: req.body.email, emailToken: req.body.emailToken, error: "New Password Cannot Be Same Old Password" })

                }
                if (!result) {
                    bcrypt.hash(req.body.password, 10, (err, hashPass) => {
                        user.findOneAndUpdate({ email: req.body.email }, { password: hashPass }, (err) => {
                            if (err) {
                                console.log(err)
                            } else {
                                res.render("authentication/newpassword", { email: req.body.email, emailToken: req.body.emailToken, success: "Password Reset Successful" })
                            }
                        })

                    })
                }
            })
        }
        if (!data) {
            res.sendStatus(404)
        }
    })



})
module.exports = Route