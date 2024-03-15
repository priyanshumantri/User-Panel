const express = require("express")
const Route = express.Router()
const userSchema = require("../../models/authentication/user")

const bcrypt = require("bcrypt")
require("dotenv").config()
const accountSid = process.env.TWILLIO_ACCOUNT_SID
const authToken = process.env.TWILLIO_AUTH_TOKEN
const verifySid = process.env.TWILLIO_VERIFY_SID
const client = require("twilio")(accountSid, authToken);

const uuid = require('uuid');
const axios = require('axios');


//log out
// Route for normal sign-out
Route.get('/sign-out', async (req, res) => {
    const db = req.dbConnection
    const userUP = db.model("users", userSchema )

    
    if(req.user) {
        const userData = await userUP.findById(req.user.id)
        const filteredSession = await userData.loginSessions.find((element)=> element.sessionToken === req.session.sessionToken)
        if(filteredSession) {
            filteredSession.isActiveSession = false
        }
        await userData.save()
    }
   
    req.session.destroy((err)=> {
        if(err) {
            console.log(err)
        } else {
           
            res.redirect("/login")
        }
    })

});






//login page
Route.get("/login", (req, res) => {

    res.render("authentication/login")
})
    
Route.post("/login", async (req, res) => {
        const { email, password, latitude, longitude } = req.body;
        const db = req.dbConnection
        const userUP = db.model("users", userSchema )
        try {
            if(!latitude || !longitude) { 
                return res.status(400).send({message : "Please allow location access", type : "location"})
             }

            const user = await userUP.findOne({ email }).populate("role").populate("branch")
            if (!user) {
                return res.status(400).send({message : "Invalid Email", type : "email"})
            }
    
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(400).send({message : "Invalid Password", type : "pass"})
            }
    
            if (user.twoFactor.sms === true) {
                client.verify.v2.services(verifySid).verifications.create({ to: "+91" + user.mobileNumber, channel: "sms" }).then((verification) => {
                    console.log(verification.status)
                }).then(() => {
                    // After OTP is sent successfully
                    req.otpSent = true;
                    res.status(302).send({mobile : user.mobileNumber, email : user.email})

                })
            } else if(user.twoFactor.email === true) {
                console.log("email")
            } else {
                req.session.userID = user.id;
                req.user = user
                var timestamp = new Date();

                const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

                const locationInfo = await axios.get(`http://ip-api.com/json/` + clientIp);
                const location = locationInfo.data.city + ", " + locationInfo.data.regionName + ", " + locationInfo.data.country

                const UAParser = require('ua-parser-js');

                // Code to get device and browser
                const userAgentString = req.headers['user-agent'];
                const parser = new UAParser();
                parser.setUA(userAgentString);

                const result = parser.getResult(); // Get the parsing result
                var proxy = false
                if(locationInfo.proxy === true) {
                    proxy = true
                }
                const device = result.device.model || 'Unknown Device';
                const browser = result.browser.name || 'Unknown Browser';
                const sessionToken = uuid.v4();
                const newObject = {
                    location : location,
                    latitude : latitude,
                    longitude : longitude,
                    device: device,
                    browser: browser,
                    ipAddress: clientIp,
                    proxy : proxy,
                    isActiveSession: true,
                    sessionToken: sessionToken,
                }

                
              user.loginSessions.push(newObject)
              user.financialYear = null
              await user.save()
               
                req.session.sessionToken = sessionToken
                if(req.session.sessionToken) {
                    res.sendStatus(200)
                }
            }
        } catch (err) {
            console.log(err);
            res.status(500).send("Internal Server Error");
        }
    });


Route.get("/two-factor/sms", (req, res) => {
    res.render("authentication/twoFactorSms", { mobile: req.query.mobileNumber, email: req.query.email })
})

Route.post("/two-factor/sms",  (req, res) => {
   
    const db = req.dbConnection
    const userUP = db.model("users", userSchema )
    const code = req.body.code_1 + req.body.code_2 + req.body.code_3 + req.body.code_4 + req.body.code_5 + req.body.code_6
    client.verify.v2.services(verifySid).verificationChecks.create({ to: "+91" + req.body.mobile, code: code }).then(async function(verification_check) {
        if (verification_check.status === "approved") {
            const user = await userUP.findOne({email : req.body.email})
            req.session.userID = user.id;
            req.user = user

            const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

            const locationInfo = await axios.get(`http://ip-api.com/json/` + clientIp);
            const location = locationInfo.data.city + ", " + locationInfo.data.regionName + ", " + locationInfo.data.country

            const UAParser = require('ua-parser-js');

            // Code to get device and browser
            const userAgentString = req.headers['user-agent'];
            const parser = new UAParser();
            parser.setUA(userAgentString);

            const result = parser.getResult(); // Get the parsing result
            var proxy = false
            if(locationInfo.proxy === true) {
                proxy = true
            }
            const device = result.device.model || 'Unknown Device';
            const browser = result.browser.name || 'Unknown Browser';
            const sessionToken = uuid.v4();
            const newObject = {
                location : location,
                latitude : req.body.latitude,
                longitude : req.body.longitude,
                device: device,
                browser: browser,
                ipAddress: clientIp,
                proxy : proxy,
                isActiveSession: true,
                sessionToken: sessionToken,
            }

            
          user.loginSessions.push(newObject)
          await user.save()
           
            req.session.sessionToken = sessionToken
            if(req.session.sessionToken) {
                return res.sendStatus(200)
            }


        } else if (verification_check.status === "pending") {
           res.status(400).send({message : "Invalid OTP"})

        }
    })
})

module.exports = Route