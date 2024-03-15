const express = require("express")
const Route = express.Router()
const upload = require("../../configs/multer")
const userSchema = require("../../models/authentication/user")
const emailVerification = require("../../custom_modules/validations/email")


Route.get("/profile/settings", (req, res) => {
    res.render("profile/settings")
})

Route.post("/profile/settings", upload.single('avatar'), async (req, res) => {
   
    const db = req.dbConnection
    const session = await db.startSession()
    const userUP = db.model("users", userSchema)
    const { firstName, lastName, email, mobileNumber } = req.body;
    const newAvatar = req.file ? req.file.filename : req.user.avatar;

    try {
        
        session.startTransaction()
        if (!firstName) {
            await session.abortTransaction()
            return res.status(400).send({ message: "First Name is required" })
        }
        
        if (!lastName) {
            await session.abortTransaction()
           return res.status(400).send({ message: "Last Name is required" })
        }
        
        if (!email) {
            await session.abortTransaction()
           return res.status(400).send({ message: "Email is required" })
        } 
    
    
    
            if (req.user.email !== email) {
                const existingUserWithEmail = await userUP.findOne({ email }, null, {session});
                if (existingUserWithEmail) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: "User with this email is already registered" });
                }
        
                const validEmail = await emailVerification.verifyEmail(email);
                if (!validEmail) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: "Please Enter A Valid Email" });
                }
            }
    
            if (mobileNumber) {
                // Check if mobileNumber is a valid 10-digit number
                const mobileRegex = /^[0-9]{10}$/;
                if (!mobileRegex.test(mobileNumber)) {
                    await session.abortTransaction()
                    return res.status(400).send({ message: "Invalid Mobile Number. Please enter a 10-digit number" });
                }
        
                // Check if mobileNumber is associated with any other user
                const existingUserWithMobile = await userUP.findOne({ mobileNumber : parseInt(mobileNumber) }, null, {session});
                if (existingUserWithMobile && existingUserWithMobile.id.toString() !== req.user._id.toString()) {
                   await session.abortTransaction()
                    return res.status(400).send({ message: "Mobile Number already associated with another user" });
                }
            }
    
           const userToUpdate = await userUP.findById(req.user._id, null, {session})
            userToUpdate.firstName = firstName
            userToUpdate.lastName = lastName
            userToUpdate.email = email
            userToUpdate.mobileNumber = mobileNumber
            userToUpdate.avatar = newAvatar
            await userToUpdate.save()
            await session.commitTransaction()
            res.sendStatus(200)
    } catch(err){
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)

    } finally {
     session.endSession()
    }


    

})

module.exports = Route