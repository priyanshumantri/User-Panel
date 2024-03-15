const express = require("express")
const Route = express.Router()

const branchesSchema = require("../../../models/masters/locations/branch")
const godownSchema = require("../../../models/masters/locations/godowns")


Route.get("/masters/godowns", async(req, res)=> {
    const db = req.dbConnection
    const branch = db.model("branches", branchesSchema)
    const godowns = db.model("godowns", godownSchema)
    const godown= db.model("godowns", godownSchema)
    const branchData = await branch.find({})
    const godownData = await godown.find({}).populate("branch")
    res.render("masters/locations/godowns/manage", {data : branchData, godownData : godownData})
})

Route.post("/masters/godowns/new", async(req, res)=> {

    const db = req.dbConnection
    const branches = db.model("branches", branchesSchema)
    const godowns = db.model("godowns", godownSchema)
  
    const session = await db.startSession();
    const { branch, name, serial, std, landline, branchEmail, managerName, managerEmail, managerMobile, address, serialToUse } = req.body;
  
    try {
      session.startTransaction();
      let errorMessage = null; // Variable to store error messages
      const newManagerName = JSON.parse(managerName)
      const newManagerMobile = JSON.parse(managerMobile)
      const newManagerEmail = JSON.parse(managerEmail)
      if (!branch || !name || !serial || !std || !landline || !branchEmail || !managerName || !managerEmail || !managerMobile || !address) {
        
        errorMessage = "Please fill all required fields";
      } else {
  
  
        const existingEmail = await godowns.findOne({ email: branchEmail });
        const existingSTD = await godowns.findOne({ std: std })
        const existingLandline = await godowns.findOne({ landline: landline });
        const existingSerial = await godowns.findOne({ serial: serial })
        if (existingEmail) {
     
          errorMessage = "Godown With That Email Already Exists";
        } else if (existingSTD) {
          
          errorMessage = "Godown With That STD Number Already Exists";
        } else if (existingLandline) {
        
          errorMessage = "Godown With That Landline Already Exists";
        } else if (existingSerial) {
         
          errorMessage = "Godown With That Serial Already Exists";
        } else {
          // Validate mobile and pinCode
          const mobileRegex = /^\d{10}$/;
  
          for (const mobile of newManagerMobile) {
            if (!mobileRegex.test(mobile.value)) {
  
              errorMessage = "Please Enter A Valid 10-Digit Mobile Number";
            }
          }
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          for (const email of newManagerEmail) {
            if (!emailRegex.test(email.value)) {
  
              errorMessage = "Please Enter A Valid Email Address";
            }
          }
  
          const numberRegex = /^[0-9]+$/;
          if (!numberRegex.test(landline)) {
  
            errorMessage = "Please Enter A Valid Landline Number";
          }
  
        }
      }
  
      if (errorMessage) {
        await session.abortTransaction();
       return res.status(400).send({ message: errorMessage });
      } else {
  
        const managerNameArray = []
        for (const name of newManagerName) {
          managerNameArray.push(name.value)
        }
  
        const managerEmailArray = []
        for (const email of newManagerEmail) {
          managerEmailArray.push(email.value)
        }
  
        const managerMobileArray = []
        for (const mobile of newManagerMobile) {
          managerMobileArray.push(parseInt(mobile.value))
        }
  
        const newGodown = new godowns({
          name: name.toUpperCase(),
          branch : branch,
          serial: serial,
          std: std,
          landline: landline,
          managerName: managerNameArray,
          managerEmail: managerEmailArray,
          managerMobile: managerMobileArray,
          address: address,
          godownEmail: branchEmail,
          createdBy: req.user.id,
          serialToUse : serialToUse
        });
  
        const savedBranchData = await newGodown.save({session})
        await branches.findByIdAndUpdate(branch, { $push: { godowns: savedBranchData.id } }, {session})
        await session.commitTransaction()
        return res.sendStatus(200)
  
  
      }
    } catch (error) {
      await session.abortTransaction();
      console.error(error);
      res.sendStatus(500);
    } finally {
      session.endSession()
    }
})


Route.post("/masters/godowns/delete", async (req, res)=> {
  const db = req.dbConnection;
  const branches = db.model("branches", branchesSchema)
  const godowns = db.model("godowns", godownSchema)
  const session = await db.startSession();
  try {
    session.startTransaction();
    const godownID = Array.isArray(req.body.id) ? req.body.id : [req.body.id];
    
    let shouldAbortTransaction = false;

    const promises = godownID.map(async (data) => {
      const godownData = await godowns.findById(data).session(session);
      if (
        godownData.lr.length > 0 ||
        godownData.users.length > 0 ||
        godownData.challans.length > 0 ||
        godownData.lorryArrivals.length > 0 ||
        godownData.deliveryChallans.length > 0
      ) {
        shouldAbortTransaction = true;
      } else {
        const deletedGodownData = await godowns.findByIdAndDelete(data).session(session);
        await branches.findByIdAndUpdate(deletedGodownData.branch, { $pull: { godowns: deletedGodownData.id } }).session(session);
      }
    });

    await Promise.all(promises);

    if (shouldAbortTransaction) {
      await session.abortTransaction();
      res.status(400).send({ message: "Godown Cannot Be Deleted" });
      return;
    }

    await session.commitTransaction();
    res.sendStatus(200);
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.sendStatus(500);
  } finally {
    session.endSession();
  }
})



//Editing Barnches
Route.get("/masters/godowns/edit", (req, res) => {
  const db = req.dbConnection
  const godowns = db.model("godowns", godownSchema)
  godowns.findById(req.query.id, (err, data) => {
    if (err) {
      console.log(err)
    } else {
      res.render("masters/locations/godowns/edit", { data: data })
    }
  })
})


Route.post("/masters/godowns/edit", async (req, res) => {
  const { id, name, serial, std, landline, address, email, managerName, managerEmail, managerMobile } = req.body;
  const db = req.dbConnection;
  const session = await db.startSession();
  const godowns = db.model("godowns", godownSchema)
  let errorMessage = null; // Initialize error message variable

  try {
    session.startTransaction();
    const newManagerName = JSON.parse(managerName);
    const newManagerMobile = JSON.parse(managerMobile);
    const newManagerEmail = JSON.parse(managerEmail);

    if (!name || !email || !managerName || !managerEmail || !address || !managerMobile || !serial || !std || !landline) {
      errorMessage = "Please fill all required fields";
    }

    // Other validation checks here...

    if (errorMessage) {
      await session.abortTransaction();
      return res.status(400).send({ message: errorMessage });
    } else {
      const managerNameArray = [];
      for (const name of newManagerName) {
        managerNameArray.push(name.value);
      }

      const managerEmailArray = [];
      for (const email of newManagerEmail) {
        managerEmailArray.push(email.value);
      }

      const managerMobileArray = [];
      for (const mobile of newManagerMobile) {
        managerMobileArray.push(parseInt(mobile.value));
      }

      const godownToUpdate = await godowns.findById(id);
      godownToUpdate.name = name.toUpperCase();
      godownToUpdate.serial = serial;
      godownToUpdate.std = std;
      godownToUpdate.landline = landline;
      godownToUpdate.managerName = managerNameArray;
      godownToUpdate.managerEmail = managerEmailArray;
      godownToUpdate.managerMobile = managerMobileArray;
      godownToUpdate.address = address;
      godownToUpdate.branchEmail = email;

      await godownToUpdate.save();
      await session.commitTransaction();
      return res.sendStatus(200);
    }
  } catch (error) {
    // Handle other errors here
    await session.abortTransaction();
    console.error(error);
    return res.sendStatus(500);
  } finally {
    session.endSession();
  }
});
module.exports = Route