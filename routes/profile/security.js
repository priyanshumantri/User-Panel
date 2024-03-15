const express = require("express")
const Route = express.Router()
require("dotenv").config()
const accountSid = process.env.TWILLIO_ACCOUNT_SID
const authToken = process.env.TWILLIO_AUTH_TOKEN
const verifySid = process.env.TWILLIO_VERIFY_SID
const client = require("twilio")(accountSid, authToken);
const userSchema = require("../../models/authentication/user")
const bcrypt = require("bcrypt")
const emailverification = require("../../custom_modules/validations/email")

Route.get("/profile/security", (req, res) => {
    res.render("profile/security")
})



Route.post("/profile/security/sms", (req, res) => {
    const db = req.dbConnection
    const user = db.model("users", userSchema)
    if(req.company.security.sms === true) {
        user.findOne({mobileNumber : req.body.mobile}, (err, data)=> {
            if(err) {
                res.sendStatus(500)
            } else if(data && data.mobileNumber !== req.user.mobileNumber) {
                res.status(400).send({message : "Mobile number already linked to another user"})
            } else {
                client.verify.v2.services(verifySid).verifications.create({ to: "+91" + req.body.mobile, channel: "whatsapp" }).then((verification) => {
                    console.log(verification.status)
                }).then(() => {
                    // After OTP is sent successfully
                            req.session.otpSent = true;
                            res.status(200).send({mobile : req.body.mobile})
            
                }).catch((err)=> {
                    res.sendStatus(500)
                })
            }
           })
    } else {
        res.status(400).send({message : "This feature is not available for your company"})
    }
})

Route.get("/profile/security/sms/verify", (req, res) => {
    if (req.query.mobileNumber) {
        res.render("profile/otpVerify", { data: req.query.mobileNumber })
    } else {
        res.sendStatus(404)
    }
})



Route.post("/profile/security/sms/verify", (req, res) => {
    const db = req.dbConnection
    const user = db.model("users", userSchema)
    const code = req.body.code_1 + req.body.code_2 + req.body.code_3 + req.body.code_4 + req.body.code_5 + req.body.code_6
    client.verify.v2.services(verifySid).verificationChecks.create({ to: "+91" + req.body.mobile, code: code }).then((verification_check) => {
        if (verification_check.status === "approved") {

            user.findByIdAndUpdate(req.user.id, { mobileNumber: req.body.mobile, 'twoFactor.sms': true }, (err) => {
                if (err) {
                    console.log(err)
                } else {
                    req.flash("success", "Two Factor Authentication Enabled Successfully")
                    res.redirect("/profile/security")
                }
            })

        } else if (verification_check.status === "pending") {
            req.flash("error", "INVALID OTP")
            res.redirect("/profile/security/sms/verify?mobileNumber=" + req.body.mobile)

        }
    })
})

Route.post("/profile/security/sms/disable", (req, res) => {
    const db = req.dbConnection
    const user = db.model("users", userSchema)
    user.findByIdAndUpdate(req.user.id, { 'twoFactor.sms': false }, (err) => {
        if (err) {
            console.log(err)
        } else {
            req.flash("success", "Two Factor Authentication Disabled Successfully")
            res.redirect("/profile/security")
        }
    })
})

Route.post("/profile/security/googleAuth", (req, res) => {
    const db = req.dbConnection
    const user = db.model("users", userSchema)
    var oldStatus = req.user.twoFactor.googleLogin
    var newStatus = false
    if (oldStatus === false) {
        newStatus = true
    }

    user.findByIdAndUpdate(req.user.id, { 'twoFactor.googleLogin': newStatus }, (err, data) => {
        if (err) {
            res.sendStatus(500)
        } else {
            var message = "OK"
            if (data.twoFactor.googleLogin === false) {
                message = "Google Authentication Enabled Successfully"
            } else {
                message = "Google Authentication Disabled Successfully"
            }
            res.status(200).send({ message: message })
        }
    })


})

Route.post("/profile/security/change-password", (req, res) => {
    const db = req.dbConnection
    const user = db.model("users", userSchema)
    bcrypt.compare(req.body.currentpassword, req.user.password, (err, result) => {
        if (err) {
            res.sendStatus(500)
        } else if (result) {
            if (req.body.newpassword !== req.body.confirmpassword) {
                res.status(400).send({ message: "Password & Confirm Password are not same" })
            } else if (req.body.newpassword.length < 8 || req.body.confirmpassword.length < 8) {
                res.status(400).send({ message: "New Password Length should be minimum 8" })
            } else if (req.body.currentpassword === req.body.newpassword) {
                res.status(400).send({ message: "New password cannot be same as old password" })
            } else {
                bcrypt.hash(req.body.newpassword, 10, (err, hashedPassword) => {
                    if (err) {
                        res.sendStatus(500)
                    } else {
                        user.findByIdAndUpdate(req.user.id, { password: hashedPassword }, (err, data) => {
                            if (err) {
                                res.sendStatus(500)
                            } else {
                                res.sendStatus(200)
                            }
                        })
                    }
                })
            }

        } else {
            res.status(400).send({ message: "Current Password is Incorrect" })
        }
    })
})

Route.post("/profile/security/change-email", (req, res) => {
    const db = req.dbConnection
    const user = db.model("users", userSchema)
    if (req.user.email === req.body.emailaddress) {
      res.status(400).send({ message: "New Email Cannot Be the Same As Old Email" });
    } else {
      
      bcrypt.compare(req.body.confirmemailpassword, req.user.password, async (err, result) => {
        if (err) {
          res.sendStatus(500);
        } else if (result) {
          const validEmail = await emailverification.verifyEmail(req.body.emailaddress);
          if (validEmail) {
            user.findByIdAndUpdate(req.user.id, {email : req.body.emailaddress}, (err, data)=>{
                if(err) {
                    res.sendStatus(500)
                } else {
                    res.sendStatus(200)
                }
            })
          } else {
            res.status(400).send({ message: "Please Enter a Valid Email" });
          }
        } else {
          res.status(400).send({ message: "Incorrect Password" });
        }
      });
    }
  });
  
module.exports = Route