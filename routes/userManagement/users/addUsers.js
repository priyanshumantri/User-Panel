const express = require("express")
const Route = express.Router()
const bcrypt = require("bcrypt")
const emailVerification = require("../../../custom_modules/validations/email")
const transporter = require("../../../configs/nodemailer")
const ejs = require("ejs")
const { activityLogger } = require("../../../custom_modules/activityLogger")


const companySchema = require("../../../models/settings/company")
const branchSchema = require("../../../models/masters/locations/branch")
const roleSchema = require("../../../models/authentication/roles")
const userSchema = require("../../../models/authentication/user")
const communicationSchema = require("../../../models/settings/communication")
const godownSchema = require("../../../models/masters/locations/godowns")

Route.post('/user-management/manage-users/add', async (req, res) => {
    const db = req.dbConnection
    const user = db.model("users", userSchema)
    const roles = db.model("roles", roleSchema)
    const communication = db.model("communications", communicationSchema)
    const company = db.model("companies", companySchema)
    const branches = db.model("branches", branchSchema)
    const godownM = db.model("godowns", godownSchema)
    const session = await db.startSession();
    

    try {
        session.startTransaction();
        const companyData = await company.findOne({}).session(session);
        const userData = await user.find({}).session(session)
        const { firstName, lastName, email, role, branch, godown } = req.body;

        

        const existingUser = await user.findOne({ email }).session(session);
        if (existingUser) {
            await session.abortTransaction();
            return res.status(400).send({message : 'User with this email already exists'})
        }

        if(companyData.maxUsers <= userData.length){
            await session.abortTransaction();
            return res.status(400).send({message : 'Max User Limit Reached'})
        }

        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const newUser = new user({
            firstName,
            lastName,
            email,
            avatar: 'default-avatar.png',
            password: hashedPassword,
            role,
            branch,
            twoFactor: {
                sms: false,
                googleLogin: true,
            },
            godown
        });

        const savedUser = await newUser.save({session})

        await roles.findByIdAndUpdate(role, { $push: { users: savedUser._id } }).session(session);
        await branches.findByIdAndUpdate(branch, { $push: { users: savedUser._id } }).session(session);
        await godownM.findByIdAndUpdate(godown, {$push : {users : savedUser._id}}).session(session)
        const commData = await communication.findOne({}).session(session);
        

        const emailToken = await bcrypt.hash(email, 1);
        const url = `http://${req.headers.host}/verify/${email}?emailToken=${emailToken}`;

        const templateData = await ejs.renderFile(__dirname + '/templates/invitation.ejs', {
            url,
            email,
            password: randomPassword,
            company: companyData,
        });

        const mainOptions = {
            from: commData.authProcess,
            to: email,
            subject: `Your login credentials at ${companyData.companyName}`,
            html: templateData,
        };

        await transporter.sendMail(mainOptions);
        await session.commitTransaction();
       

        activityLogger(req, `Created a new user with email: ${email}`, '200');
        res.sendStatus(200);
    } catch (error) {
        await session.abortTransaction();
        console.log(error)
        activityLogger(req, `Failed to create a new user: ${error.message}`, '500');
        res.sendStatus(500);
    } finally {
        session.endSession()
    }
});



module.exports = Route
