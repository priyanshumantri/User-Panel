const express = require("express")
const userSchema = require("../../../models/authentication/user")
const roleSchema = require("../../../models/authentication/roles")
const Route = express.Router()
require('dotenv').config();
const {activityLogger} = require("../../../custom_modules/activityLogger")
const branchSchema = require("../../../models/masters/locations/branch")
const godownSchema = require("../../../models/masters/locations/godowns")

Route.get("/user-management/manage-users/edit", async(req, res) => {
  const db = req.dbConnection
  const user = db.model("users", userSchema)
  const branch = db.model("branches", branchSchema)
  const role = db.model("roles", roleSchema)
  const godown = db.model("godowns", godownSchema)

  const userData = await user.findById(req.query.userID)
  const branchData = await branch.find({})
  const roleData = await role.find({})
  const godownData = await godown.find({branch : userData.branch})

  res.render("userManagement/users/editUser", { userData: userData, roleData: roleData, branchData : branchData, godownData : godownData })
})

Route.post("/user-management/manage-users/edit", async(req, res) => {
  const db = req.dbConnection
  const user = db.model("users", userSchema)
  const branch = db.model("branches", branchSchema)
  const role = db.model("roles", roleSchema)
  const godown = db.model("godowns", godownSchema)
  const session = await db.startSession()
    const updateUser = async (req, res) => {
        try {
          session.startTransaction()
          // Check if required fields are missing
          if (!req.body.firstName || !req.body.lastName || !req.body.email || !req.body.role || !req.body.branch || !req.body.godown) {
            await session.abortTransaction()
            return res.status(400).send({message : "Please Fill All Required Fields"})
            }
      
          // Check if the email already exists for another user
          const existingUser = await user.findOne({ email: req.body.email });
          if (existingUser && existingUser.id !== req.body.userID) {
            await session.abortTransaction()
            return res.status(400).send({message : "Email Already linked To Another User"})
          }
      
          // Check if the mobile number already exists for another user
          const existingUserWithMobile = await user.findOne({ mobileNumber: req.body.mobileNumber });
          if (existingUserWithMobile && existingUserWithMobile.id !== req.body.userID) {
            await session.abortTransaction()
            return res.status(400).send({message : "Email Already linked To Another User"})
          }
      
          // Update user data
          const updatedUserData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            mobileNumber: req.body.mobileNumber,
            role: req.body.role,
            branch : req.body.branch,
            godown : req.body.godown
          };
      
          // Update user by userID
           await user.findByIdAndUpdate(req.body.userID, updatedUserData, {session}).exec()
      
          // Remove user from oldRole and add to newRole
          await role.findByIdAndUpdate(req.body.oldRole, { $pull: { users: req.body.userID } },  {session}).exec()
          await role.findByIdAndUpdate(req.body.role, { $push: { users: req.body.userID } },  {session}).exec()

          //Removing user from old branch and adding in new branch
         if(req.body.oldBranch !== "") {
          await branch.findByIdAndUpdate(req.body.oldBranch, {$pull : { users : req.body.userID }},  {session}).exec()
         }
          await branch.findByIdAndUpdate(req.body.branch, {$push : {users : req.body.userID}},  {session}).exec()

          //Removing user from old godown and adding in new godown
         if(req.body.oldGodown !== "") {
          await godown.findByIdAndUpdate(req.body.oldGodown, {$pull : { users : req.body.userID }},  {session}).exec()
         }
          await godown.findByIdAndUpdate(req.body.godown, {$push : {users : req.body.userID}},  {session}).exec()
      
          // Log activity
          activityLogger(req, `User email edited from ${req.body.oldEmail} to ${req.body.email}`, "200");
          await session.commitTransaction()
          res.sendStatus(200); // Success
        } catch (error) {
          await session.abortTransaction()
          console.error(error);
          activityLogger(req, "Failed to edit a user", "500");
          res.sendStatus(500); // Internal Server Error
        } finally {
          session.endSession()
        }
      };
      
      // Usage
      updateUser(req, res);
      

})

module.exports = Route