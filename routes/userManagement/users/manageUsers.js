const express = require("express")
const Route = express.Router()
const userSchema = require("../../../models/authentication/user")
const roleSchema = require("../../../models/authentication/roles")
const { activityLogger } = require("../../../custom_modules/activityLogger")
const ExcelJS = require("exceljs")
const path = require('path');
const fs = require("fs")
const pdf = require('html-pdf');
const ejs = require('ejs');
const branchesSchema = require("../../../models/masters/locations/branch")


Route.get("/user-management/manage-users", (req, res) => {
    const db = req.dbConnection
    const branches = db.model("branches", branchesSchema)
    const user = db.model("users", userSchema)
    const role = db.model("roles", roleSchema)
    user.find({}).populate("role").then((userData) => {
        role.find({}, (err, roleData) => {
            if (err) {

                console.log(err)
            } else {

                branches.find({}).then((branchData)=> {
                    
                res.render("userManagement/users/manageUsers", { users: userData, roles: roleData, branchData : branchData })
                })

            }
        })
    })
})



Route.post('/user-management/manage-users/delete', async (req, res) => {
    const db = req.dbConnection
    const user = db.model("users", userSchema)
    const branch = db.model("branches", branchesSchema)
    const role = db.model("roles", roleSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const { id } = req.body;
        const idsToDelete = Array.isArray(id) ? id : [id];

        const userDeleteID = [];
        const lockedUsers = [];
        let self = []
        for (const data of idsToDelete) {
            const userData = await user.findById(data, null, {session});

            if (userData.lock) {
                lockedUsers.push(userData.email);
                
            } else if(userData.id.toString() === req.user.id.toString()) {
                self.push(userData.email);
            } else {
                userDeleteID.push(userData.id);
            }
        }

        if(self.length > 0)  {
            await session.abortTransaction()
            activityLogger(req, 'Failed to delete a Locked User', '400');
            return res.status(400).send({ message: 'You Cant Delete Your Own Account' });
        } else if (userDeleteID.length === 0) {
            await session.abortTransaction()
            activityLogger(req, 'Failed to delete a Locked User', '400');
            return res.status(400).send({ message: 'Cant Delete A Locked User' });
        }

        for (const data of userDeleteID) {
            await user.findByIdAndDelete(data, {session}).exec()
            await role.findByIdAndUpdate(data.role, { $pull: { users: data } }, {session}).exec()
        }

        if (lockedUsers.length > 0) {
            await session.commitTransaction()
            activityLogger(req, 'Deleted Users but deletion of locked account prevented', 200);
            res.status(200).send({ message: 'User accounts that were not locked are successfully deleted' });
        } else {
            await session.commitTransaction()
            activityLogger(req, 'Deleted Users', 200);
            res.status(200).send({ message: 'Deleted All Selected Users' });
        }
    } catch (error) {
        await session.abortTransaction()
        console.error(error);
        activityLogger(req, 'Failed to delete a user', '500');
        res.sendStatus(500);
    } finally {
        session.endSession()
    }
});


Route.post('/masters/users/export', async (req, res) => {
  if(req.body.format === "xlsx" || req.body.format === "csv") {
    const data = await user.find({role : req.body.role})
  try {

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("My Users")
      worksheet.columns = [
          {header : "First Name", key : "firstName", width : 10},
          {header : "Last Name", key : "lastName", width : 10},
          {header : "Email", key : "email", width : 10},
          {header : "Mobile Number", key : "mobileNumber", width : 20},
      ]
      data.forEach(user=> {
          worksheet.addRow(user)
      })

      worksheet.getRow(1).eachCell((cell)=> {
          cell.font = {bold:true}
      })

       workbook.xlsx.writeFile("public/exports/users.pdf").then(()=> {
          res.status(200).send({format : req.body.format})
       })
     


  } catch(error) {
      console.log(error)
  }
  } else {
    const data = await user.find({role : req.body.role})
   // Load your EJS template file
   const ejsTemplatePath = path.join(__dirname, 'templates', 'table.ejs');



// Render the EJS template with data
ejs.renderFile(ejsTemplatePath, {data}, (err, renderedHtml) => {
  if (err) {
    console.error(err);
  } else {
    // PDF generation options
    const pdfOptions = { format: 'Letter' }; // Adjust options as needed
    const outputPath = 'public/exports/users.pdf';

    // Generate the PDF from the rendered HTML content
    pdf.create(renderedHtml, pdfOptions).toFile(outputPath, (pdfErr, response) => {
      if (pdfErr) {
        console.error(pdfErr);
      } else {
        res.status(200).send({format : req.body.format})
      }
    });
  }
});
  }
  });


Route.get("/delete-file", (req, res) => {
    const filepath = path.join(__dirname + "../../../../public/exports/" + req.query.filename)
    fs.unlink(filepath, (err) => {
        if (err) {
            console.log(err)
        } else {
            console.log("file delted")
        }
    })
})
module.exports = Route