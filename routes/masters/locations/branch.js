const express = require("express")
const Route = express.Router()
const EmailVerification = require("../../../custom_modules/validations/email")
const citiesSchema = require("../../../models/masters/locations/cities")
const branchesSchema = require("../../../models/masters/locations/branch")
const statesSchema = require("../../../models/masters/locations/states")
const userSchema = require("../../../models/authentication/user")
const countrySchema = require("../../../models/masters/locations/country")
const companySchema = require("../../../models/settings/company")
const branchSchema = require("../../../models/masters/locations/branch")
const ledgerSchema = require("../../../models/masters/ledgers")
const groupSchema = require("../../../models/masters/groups")

// Branch Management page
Route.get("/masters/branches", (req, res) => {
  const db = req.dbConnection
  const states = db.model("states", statesSchema)
  const branches = db.model("branches", branchesSchema)
  branches.find({}).populate("city").populate("state").populate("addedBy").then((branchData) => {
    states.find({}).populate("state").then((data) => {
      res.render("masters/branches/manage", { stateData: data, branchData: branchData })

    })
  })
})



// Adding a new branch
Route.post("/masters/branches/new", async (req, res) => {


  const db = req.dbConnection
  const states = db.model("states", statesSchema)
  const branches = db.model("branches", branchesSchema)
  const country = db.model("countries", countrySchema)
  const company = db.model("companies", companySchema)
  const ledgerM = db.model("ledgers", ledgerSchema)
  const groupM = db.model("groups", groupSchema)
  const session = await db.startSession();
  const { state, name, serial, std, landline, branchEmail, managerName, managerEmail, managerMobile, address } = req.body;

  try {
    session.startTransaction();
    const branchData = await branches.find({}).session(session)
    const companyData = await company.findOne({}).session(session)
    let errorMessage = null; // Variable to store error messages
    const newManagerName = JSON.parse(managerName)
    const newManagerMobile = JSON.parse(managerMobile)
    const newManagerEmail = JSON.parse(managerEmail)
    if (!state || !name || !serial || !std || !landline || !branchEmail || !managerName || !managerEmail || !managerMobile || !address) {

      errorMessage = "Please fill all required fields";
    } else if (companyData.maxBranches <= branchData.length) {

      errorMessage = "Max Branch Limit Reached";
    } else {


      const existingEmail = await branches.findOne({ email: branchEmail });
      const existingSTD = await branches.findOne({ std: std })
      const existingLandline = await branches.findOne({ landline: landline });
      const existingSerial = await branches.findOne({ serial: serial })
      if (existingEmail) {

        errorMessage = "Branch With That Email Already Exists";
      } else if (existingSTD) {

        errorMessage = "Branch With That STD Number Already Exists";
      } else if (existingLandline) {

        errorMessage = "Branch With That Landline Already Exists";
      } else if (existingSerial) {

        errorMessage = "Branch With That Serial Already Exists";
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


      //creating default groups for the branch
      const defaultGroups = [
        {
          name: `Sundry Debtors - ${name.toUpperCase()}`,
          field: "Sundry Debtors"
        },
        {
          name: `Sundry Creditors - ${name.toUpperCase()}`,
          field: "Sundry Creditor"
        },
        {
          name: `Indirect Expenses - ${name.toUpperCase()}`,
          field: "Indirect Expenses"
        },
        {
          name: `Direct Expenses - ${name.toUpperCase()}`,
          field: "Direct Expenses"
        }, 
        {
          name: `Indirect Income - ${name.toUpperCase()}`,
          field: "Indirect Income"
        },
        {
          name: `Booking - ${name.toUpperCase()}`,
          field : "Sales Account"
        }
        ]
    
        const defaultLedgers = [{
        name: `Cash In Hand - ${name.toUpperCase()}`,
        field: "Cash in Hand"
        },
        {
        name: `Booking TBB - ${name.toUpperCase()}`,
        field: `Booking - ${name.toUpperCase()}`
        },
        {
        name: `Booking To Pay - ${name.toUpperCase()}`,
        field: `Booking - ${name.toUpperCase()}`
        },
        {
        name: `Booking Paid - ${name.toUpperCase()}`,
        field: `Booking - ${name.toUpperCase()}`
        },
        {
        name: `SGST - ${name.toUpperCase()}`,
        field: "Duties & Taxes"
        },
        {
        name: `CGST - ${name.toUpperCase()}`,
        field: "Duties & Taxes"
        },
        {
        name: `IGST - ${name.toUpperCase()}`,
        field: "Duties & Taxes"
        },
        {
        name : `TDS On Lorry Hire - ${name.toUpperCase()}`,
        field : "Duties & Taxes"
        },
        {
        name : `Lorry Hire Expenses - ${name.toUpperCase()}`,
        field : `Direct Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Halting Expenses - ${name.toUpperCase()}`,
        field : `Direct Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Height Expenses - ${name.toUpperCase()}`,
        field : `Direct Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Business Promotion Expenses - ${name.toUpperCase()}`,
        field : `Direct Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Labour Expenses - ${name.toUpperCase()}`,
        field : `Direct Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Crossing Expenses - ${name.toUpperCase()}`,
        field : `Direct Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Collection Expenses - ${name.toUpperCase()}`,
        field : `Direct Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Door Delivery Expenses - ${name.toUpperCase()}`,
        field : `Direct Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Conveyance Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Electricity Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Godown Rent - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Office Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        }, {
        name : `Petrol Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Pooja Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Postage & Courier Expenses- ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Printing & Stationery Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Rebate Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Repair & Maintenance Godown - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        }, {
        name : `Repair & Maintenance Electric - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Repair & Maintenance Vehicle - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Salary Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Staff Welfare Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Telephone Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Travelling Expenses - ${name.toUpperCase()}`,
        field : `Indirect Expenses - ${name.toUpperCase()}`
        },
        {
        name : `Mamul Tapal Advance - ${name.toUpperCase()}`,
        field : `Indirect Income - ${name.toUpperCase()}`
        },
        {
        name : `Mamul Tapal Balance - ${name.toUpperCase()}`,
        field : `Indirect Income - ${name.toUpperCase()}`
        },
        {
        name : `Unloading Lorry - ${name.toUpperCase()}`,
        field : `Indirect Income - ${name.toUpperCase()}`
        },
        {
        name : `Balance Lorry Hire - ${name.toUpperCase()}`,
        field : `Lorry Hire (Creditors)`
        },
        {
        name : `Advance Lorry Hire - ${name.toUpperCase()}`,
        field : `Lorry Hire (Creditors)`
        },
        {
          name : `Crossing Commission - ${name.toUpperCase()}`,
          field : `Direct Expenses - ${name.toUpperCase()}`
        }
        ]

      let groupArray = []
      for (const group of defaultGroups) {
        const groupData = await groupM.findOne({ name: group.field }).session(session)
        const newGroup = new groupM({
          name: group.name,
          lock: true,
          under: groupData.id,
        })
        const data = await newGroup.save({ session })
        groupArray.push(data.id)
      }
      let i = 0
      let ledgerArray = []
      for (const ledger of defaultLedgers) {
        let groupData = await groupM.findOne({ name: ledger.field }).session(session)
        const newLedger = new ledgerM({
          name: ledger.name,
          openingBalance: {
            fy: req.user.financialYear,
          },
          group: groupData.id,
          defaultLedger: true
        })
        const data = await newLedger.save({ session })
        ledgerArray.push(data.id)
        i++
      }


      const newBranch = new branches({
        name: name.toUpperCase(),
        state: state,
        serial: serial,
        std: std,
        landline: landline,
        managerName: managerNameArray,
        managerEmail: managerEmailArray,
        managerMobile: managerMobileArray,
        address: address,
        branchEmail: branchEmail,
        createdBy: req.user.id,
        sundryDebtors: groupArray[0],
        sundryCreditors: groupArray[1],
        cashInHand: ledgerArray[0],
        bookingTBB: ledgerArray[1],
        bookingToPay: ledgerArray[2],
        bookingPaid: ledgerArray[3],
        SGST: ledgerArray[4],
        CGST: ledgerArray[5],
        IGST: ledgerArray[6],
        tdsOnLorryHire: ledgerArray[7],
        lorryHireExpenses: ledgerArray[8],
        haltingExpenses: ledgerArray[9],
        heightExpenses: ledgerArray[10],
        businessPromotionExpenses: ledgerArray[11],
        labourExpenses: ledgerArray[12],
        crossingExpenses: ledgerArray[13],
        collectionExpenses: ledgerArray[14],
        doorDeliveryExpenses: ledgerArray[15],
        conveyanceExpenses: ledgerArray[16],
        electricityExpenses: ledgerArray[17],
        godownRent: ledgerArray[18],
        officeExpenses: ledgerArray[19],
        petrolExpenses: ledgerArray[20],
        poojaExpenses: ledgerArray[21],
        postageCourierExpenses: ledgerArray[22],
        printingStationeryExpenses: ledgerArray[23],
        rebateExpenses: ledgerArray[24],
        repairMaintenanceGodown: ledgerArray[25],
        repairMaintenanceElectric: ledgerArray[26],
        repairMaintenanceVehicle: ledgerArray[27],
        salaryExpenses: ledgerArray[28],
        staffWelfareExpenses: ledgerArray[29],
        telephoneExpenses: ledgerArray[30],
        travellingExpenses: ledgerArray[31],
        mamulTapalAdvance: ledgerArray[32],
        mamulTapalBalance: ledgerArray[33],
        unloadingLorry: ledgerArray[34],
        balanceLorryHire : ledgerArray[35],
        advanceLorryHire : ledgerArray[36]
      });



      const savedBranchData = await newBranch.save({ session })
      const savedState = await states.findByIdAndUpdate(state, { $push: { branches: savedBranchData.id } }, { session })
      await country.findByIdAndUpdate(savedState.country, { $push: { branches: savedBranchData.id } }, { session })
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
});




//Editing Barnches
Route.get("/masters/branches/edit", (req, res) => {
  const db = req.dbConnection
  const branches = db.model("branches", branchesSchema)
  branches.findById(req.query.id, (err, data) => {
    if (err) {
      console.log(err)
    } else {
      res.render("masters/branches/edit", { data: data })
    }
  })
})


Route.post("/masters/branches/edit", async (req, res) => {
  const { id, name, serial, std, landline, address, email, managerName, managerEmail, managerMobile } = req.body;
  const db = req.dbConnection;
  const session = await db.startSession();
  const branches = db.model("branches", branchSchema)
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

      const branchToUpdate = await branches.findById(id);
      branchToUpdate.name = name.toUpperCase();
      branchToUpdate.serial = serial;
      branchToUpdate.std = std;
      branchToUpdate.landline = landline;
      branchToUpdate.managerName = managerNameArray;
      branchToUpdate.managerEmail = managerEmailArray;
      branchToUpdate.managerMobile = managerMobileArray;
      branchToUpdate.address = address;
      branchToUpdate.branchEmail = email;

      await branchToUpdate.save();
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



//Deleting Branches 

// Add Conditions for deleting a branch as and when the requirements arise when software dev proceeds. for eg if a branch has LR or someother data then the branch cant be deleted
Route.post("/masters/branches/delete", async (req, res) => {
  const db = req.dbConnection;
  const states = db.model("states", statesSchema);
  const branches = db.model("branches", branchesSchema);
  const country = db.model("countries", countrySchema);
  const session = await db.startSession();
  const company = db.model("companies", companySchema)
  try {
    session.startTransaction();
    const branchID = Array.isArray(req.body.id) ? req.body.id : [req.body.id];

    let shouldAbortTransaction = false;

    const promises = branchID.map(async (data) => {
      const branchData = await branches.findById(data).session(session);
      if (
        branchData.lr.length > 0 ||
        branchData.billingLR.length > 0 ||
        branchData.users.length > 0 ||
        branchData.challans.length > 0 ||
        branchData.lorryArrivals.length > 0 ||
        branchData.deliveryChallans.length > 0
      ) {
        shouldAbortTransaction = true;
      } else {
        const deletedBranchData = await branches.findByIdAndDelete(data).session(session);
        const stateData = await states.findByIdAndUpdate(deletedBranchData.state, { $pull: { branches: deletedBranchData.id } }).session(session);
        await country.findByIdAndUpdate(stateData.country, { $pull: { branches: deletedBranchData.id } }).session(session);
      }
    });

    await Promise.all(promises);

    if (shouldAbortTransaction) {
      await session.abortTransaction();
      return res.status(400).send({ message: "Branch Cannot Be Deleted" });
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
});





module.exports = Route