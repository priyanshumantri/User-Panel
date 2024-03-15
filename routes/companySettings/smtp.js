const express = require("express")
const Route = express.Router()
const smtp = require("../../models/settings/smtp")
const nodemailer = require("nodemailer")
const fs = require('fs')
const {activityLogger} = require("../../custom_modules/activityLogger")

Route.get("/settings/smtp", (req, res) => {

    smtp.findOne({}, (err, data) => {
        if (err) {
          
            console.log(err)
        } else {
          
            res.render("companySettings/smtp", { smtpData: data })
        }
    })

})


Route.post("/settings/smtp", (req, res) => {

  if(!req.body.host || !req.body.port || !req.body.secure || !req.body.email || !req.body.password) {
    activityLogger(req, `Couldnt update smtp settings since all fields were required`, "400");
    req.flash("error", "All fields are required")
    res.redirect("/settings/smtp")
  } else {
    let transporter = nodemailer.createTransport({
        host : req.body.host,
        port : req.body.port,
        secure : req.body.secure,
        auth : {
            user : req.body.email,
            pass : req.body.password
        }
    })   
    
    transporter.verify(function (error, success) {
        if (error) {
          console.log(error)
          activityLogger(req, `Failed to update SMTP setiings due to invalid credentials`, "500");
          req.flash("error", "Something went wrong! Check settings again before updating")
          res.redirect("/settings/smtp")
        } else {
            
          
          smtp.findOneAndUpdate({}, {host : req.body.host, port : req.body.port, secure : req.body.secure, email : req.body.email, password : req.body.password}, (err, data)=> {
            if(err) {
              console.log(err)
            } else {
              const smtpData = "const nodemailer = require(\"nodemailer\"); let transporter = nodemailer.createTransport({pool: true, host:\"" + req.body.host + "\", port:" + req.body.port + ", secure:" + req.body.secure + ", auth: { user:\"" + req.body.email + "\", pass:\"" + req.body.password + "\" } }); module.exports = transporter"

              fs.writeFile('./configs/nodemailer.js', smtpData, (err) => {
                  if (err) {
                    activityLogger(req, `Failed to update SMTP Details in configurations`, "500");
                      console.log(err)
                  } else {
                      transporter.verify(function (error, success) {
                          if (error) {
                            console.log(error);
                          } else {
                            activityLogger(req, `Updated SMTP Details`, "200");
                            req.flash("success", "SMTP Settings updated successfully")
                            res.redirect("/settings/smtp")
                          }
                        });
                  }
              })
            }
          })


        }
      });
  }

})

module.exports = Route