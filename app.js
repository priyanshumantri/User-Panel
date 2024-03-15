//express setup
const express = require("express")
const app = express()
const session = require("express-session")
const subdomain = require('express-subdomain');
const flash = require("connect-flash")
const cookieParser = require('cookie-parser');
const MongoStore = require("connect-mongo")
// View Engine And Directory Set
app.set("view engine", "ejs")
app.use(express.static(__dirname + "/public"))


const clientChecker = require("./configs/client")
const connectDB = require("./configs/database")
const sendData = require("./configs/sendData")
const checkFinancialYear = require("./configs/checkFinancialYear")

app.use(clientChecker())
app.use(connectDB())
app.use(checkFinancialYear())






//express forms data
app.use(express.urlencoded({ extended: true }))
app.use(express.json());



// Middleware to format JSON responses for readability
app.set('json spaces', 2);

// to pass db name we put it fucntion

app.use(cookieParser()); // Use cookie-parser middleware
app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in a production environment with HTTPS
      maxAge: 1.08e+7, // Session duration in milliseconds (e.g., 1 hour)
    },
    store: MongoStore.create({
      mongoUrl: 'mongodb+srv://meghacargoservice:LaLaMaN%405468%40LaLaMaN@test.pop9auc.mongodb.net/sessions?retryWrites=true&w=majority', // MongoDB connection URL
      collection: 'sessions', // Name of the sessions collection
    }),
  })
);
app.use(flash());


app.use(sendData())
// app.use(checkFinancialYear())







const checkOtpSent = require("./middleware/authentication/checkOTPSent")
//Authentication Pages
const { loginPageCheck } = require("./middleware/authentication/auth")




// Login Page
const loginPage = require("./routes/authentication/login")
app.get("/login", loginPageCheck, loginPage)
app.post("/login", loginPage)
app.get("/sign-out", loginPage)
app.get("/two-factor/sms", checkOtpSent, loginPage)
app.post("/two-factor/sms", loginPage)

app.get("/", (req, res) => {
  res.redirect("/login")
})




// password reset pages
const passReset = require("./routes/authentication/reset")
app.get("/reset-password", passReset)
app.post("/reset-password", passReset)
app.get("/reset/:email", passReset)
app.post("/password-reset", passReset)





const { checkLogin, canRead, canCreate, canWrite, canDelete } = require("./middleware/authentication/permissions")




const selectSession = require("./routes/authentication/select-session")
app.get("/select-session", checkLogin(), selectSession)
app.post("/select-session", checkLogin(), selectSession)

const checkLoginSession = require("./configs/checkLoginSession")

app.use(checkLoginSession())

//Dashboard
const dashboard = require("./routes/dashboard")

app.get("/dashboard", checkLogin(), dashboard)





//User Management ========================================================================>
const userManagement = require("./routes/userManagement/users/manageUsers")
app.get("/user-management/manage-users", checkLogin(), canRead("users"), userManagement);
app.post("/masters/users/export", checkLogin(), userManagement)
app.get("/delete-file", checkLogin(), userManagement)



//Add User
const addUser = require("./routes/userManagement/users/addUsers")
app.post("/user-management/manage-users/add", checkLogin(), canCreate("users"), addUser)


// Edit User
const editUser = require("./routes/userManagement/users/editUser")
app.get("/user-management/manage-users/edit", checkLogin(), canWrite("users"), editUser)
app.post("/user-management/manage-users/edit", checkLogin(), canWrite("users"), editUser)


//Delete User
app.post("/user-management/manage-users/delete", canDelete("users"), userManagement)









//Roles ==================================================================================>
const roles = require("./routes/userManagement/roles/roles")
app.get("/user-management/roles", checkLogin(), canRead("roles"), roles)
// new roles
const addRoles = require("./routes/userManagement/roles/addRoles")
app.post("/user-management/roles/new", checkLogin(), canCreate("roles"), addRoles)

// Edit Roles
const editRoles = require("./routes/userManagement/roles/editRoles")
app.get("/user-management/roles/edit", checkLogin(), canWrite("roles"), editRoles)
app.post("/user-management/roles/edit", checkLogin(), canWrite("roles"), editRoles)
app.post("/user-management/roles/delete", checkLogin(), canDelete("roles"), editRoles)



//PERMISSIONS
const newPermission = require("./routes/userManagement/permissions/new")


app.get("/user-management/permissions", checkLogin(), canRead("permissions"), newPermission)
app.post("/user-management/permissions", checkLogin(), canCreate("permissions"), newPermission)
app.post("/user-management/permissions/edit", checkLogin(), canWrite("permissions"), newPermission)
app.post("/user-management/permissions/delete", checkLogin(), canDelete("permissions"), newPermission)





//Actions
const actions = require("./routes/actions")
app.get("/actions", checkLogin(), actions)
app.post("/actions", checkLogin(), actions)





// Masters =====================================================================>
// Branches
const branches = require("./routes/masters/locations/branch")
app.get("/masters/branches", checkLogin(), branches)
app.post("/masters/branches/new", checkLogin(), branches)
app.get("/masters/branches/edit", checkLogin(), branches)
app.post("/masters/branches/delete", checkLogin(), branches)
app.post("/masters/branches/edit", checkLogin(), branches)


const godowns = require("./routes/masters/locations/godowns")
app.get("/masters/godowns", checkLogin(), godowns)
app.post("/masters/godowns/new", checkLogin(), godowns)
app.post("/masters/godowns/delete", checkLogin(), godowns)
app.get("/masters/godowns/edit", checkLogin(), godowns)
app.post("/masters/godowns/edit", checkLogin(), godowns)

//Groups
const groups = require("./routes/masters/groups")
app.get("/masters/groups", checkLogin(), groups)
app.post("/masters/groups/new", checkLogin(), groups)
app.post("/masters/groups/delete", checkLogin(), groups)
app.post("/masters/groups/edit", checkLogin(), groups)

// Ledgers
const ledgers= require("./routes/masters/ledgers")
app.get("/masters/ledgers", checkLogin(), ledgers)
app.get("/masters/ledgers/get-fields", checkLogin(), ledgers)
app.get("/masters/ledgers/edit", checkLogin(), ledgers)
app.post("/masters/ledgers/new", checkLogin(), ledgers)
app.post("/masters/ledgers/edit", checkLogin(), ledgers)
app.post("/masters/ledgers/delete", checkLogin(), ledgers)
app.get("/masters/ledgers/get-opening-balance", checkLogin(), ledgers)
app.post("/masters/ledgers/set-opening-balance", checkLogin(), ledgers)
app.get("/masters/get-gst-data", checkLogin(), ledgers)
//Sub Ledgers
const subLedgers = require("./routes/masters/sub-ledgers")
app.get("/masters/sub-ledgers", checkLogin(), subLedgers)
app.post("/masters/sub-ledgers/new", checkLogin(), subLedgers)
app.post("/masters/sub-ledgers/delete", checkLogin(), subLedgers)
app.post("/masters/sub-ledgers/edit", checkLogin(), subLedgers)
// Goods Description
const goodsDescription = require("./routes/masters/goodsDescription")
app.get("/masters/goods-description", checkLogin(), goodsDescription)
app.post("/masters/goods-description", checkLogin(), goodsDescription)
app.post("/masters/goods-description/edit", checkLogin(), goodsDescription)
app.post("/masters/goods-description/delete", checkLogin(), goodsDescription)

// Insuarance
const insuarance = require("./routes/masters/insuarance")
app.get("/masters/insuarance/new", checkLogin(), insuarance)
app.get("/masters/insuarance/manage", checkLogin(), insuarance)


// Method of packaging
const mop = require("./routes/masters/method-of-packaging")
app.get("/masters/method-of-packaging", checkLogin(), mop)
app.post("/masters/method-of-packaging/new", checkLogin(), mop)
app.post("/masters/method-of-packaging/delete", checkLogin(), mop)
app.post("/masters/method-of-packaging/edit", checkLogin(), mop)


// rate %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%//
//rate ON/getConsignorConsignee
const rate = require("./routes/masters/rates/rate-on")
app.get("/masters/rates/rate-on", checkLogin(), rate)
app.post("/masters/rates/rate-on", checkLogin(), rate)
app.post("/masters/rates/rate-on/edit", checkLogin(), rate)
app.post("/masters/rates/rate-on/delete", checkLogin(), rate)

//Client Rate Master
const clientRateMaster = require("./routes/masters/rates/rate-master")
app.get("/masters/rates/rate-master", checkLogin(), clientRateMaster)
app.get("/get-cities", checkLogin(), clientRateMaster)
app.get("/masters/rates/rate-master/edit", checkLogin(), clientRateMaster)
app.post("/masters/rates/rate-master", checkLogin(), clientRateMaster)
app.post("/masters/rates/rate-master/edit", checkLogin(), clientRateMaster)
app.post("/masters/rates/rate-master/delete", checkLogin(), clientRateMaster)
//LOCATIONS ==============================================================================>
const countries = require("./routes/masters/locations/country")
app.get("/masters/locations/countries", checkLogin(), countries)
app.post("/masters/locations/countries/edit", checkLogin(), countries)
app.post("/masters/locations/countries/delete", checkLogin(), countries)


const zones = require("./routes/masters/locations/zones")
app.get("/masters/locations/zones", checkLogin(), zones)
app.post("/masters/locations/zones/new", checkLogin(), zones)
app.post("/masters/locations/zones/edit", checkLogin(), zones)
app.post("/masters/locations/zones/delete", checkLogin(), zones)
const common = require("./routes/masters/locations/common")
app.get("/masters/locations/get-states", checkLogin(), common)
app.get("/masters/locations/get-zones", checkLogin(), common)

// States
const states = require("./routes/masters/locations/states")

app.get("/masters/states", checkLogin(), states)
app.post("/masters/states/new", checkLogin(), states)
app.post("/masters/states/edit", checkLogin(), states)
app.post("/masters/states/delete", checkLogin(), states)



// Cities
const cities = require("./routes/masters/locations/cities")
app.get("/masters/cities", checkLogin(), cities)
app.post("/masters/cities/new", checkLogin(), cities)
app.post("/masters/cities/edit", checkLogin(), cities)
app.post("/masters/cities/delete", checkLogin(), cities)



// Destinations
const destinations = require("./routes/masters/destinations")
app.get("/masters/destinations", checkLogin(), destinations)
app.post("/masters/destinations/new", checkLogin(), destinations)
app.post("/masters/destinations/edit", checkLogin(), destinations)
app.post("/masters/destinations/delete", checkLogin(), destinations)





//Vehicles
const vehicle = require("./routes/masters/vehicle")
app.get("/masters/vehicles", checkLogin(), canRead("vehicles"), vehicle)
app.get("/masters/vehicles/edit", checkLogin(), canWrite("vehicles"), vehicle)
app.post("/masters/vehicles/edit", checkLogin(), canWrite("vehicles"), vehicle)
app.post("/masters/vehicles/new", checkLogin(), canCreate("vehicles"), vehicle)
app.post("/masters/vehicles/delete", checkLogin(), canDelete("vehicles"), vehicle)


//brokers
const brokers = require("./routes/masters/brokers")
app.get("/masters/brokers", checkLogin(), brokers)
app.post("/masters/brokers/new", checkLogin(), brokers)
app.get("/masters/brokers/edit", checkLogin(), brokers)
app.post("/masters/brokers/edit", checkLogin(), brokers)
app.post("/masters/brokers/delete", checkLogin(), brokers)
//owners
app.get("/masters/vehicles/owners", checkLogin(), canRead("owners"), vehicle)
app.post("/masters/vehicles/owners/new", checkLogin(), canCreate("owners"), vehicle)
app.post("/masters/vehicles/owners/edit", checkLogin(), canWrite("owners"), vehicle)
app.post("/masters/vehicles/owners/delete", checkLogin(), canDelete("owners"), vehicle)


//drivers
app.get("/masters/vehicles/drivers", checkLogin(), canRead("drivers"), vehicle)
app.post("/masters/vehicles/drivers/new", checkLogin(), canCreate("drivers"), vehicle)
app.post("/masters/vehicles/drivers/delete", checkLogin(), canDelete("drivers"), vehicle)
app.post("/masters/vehicles/drivers/edit", checkLogin(), canWrite("drivers"), vehicle)
app.get("/masters/vehicles/getVehicleDetails", checkLogin(), vehicle)

//Company Settings ======================================================================>
//Overview
const companySettingsOverview = require("./routes/companySettings/overview")
app.get("/settings/overview", checkLogin(), canRead("overview"), companySettingsOverview)
app.post("/settings/overview", checkLogin(), canWrite("overview"), companySettingsOverview)

//SMTP
const companySettingsSMTP = require("./routes/companySettings/smtp")
app.get("/settings/smtp", checkLogin(), canRead("overview"), companySettingsSMTP)
app.post("/settings/smtp", checkLogin(), canWrite("overview"), companySettingsSMTP)

//Communication Emails
const companyCommunicationEmail = require("./routes/companySettings/communication")
app.get("/settings/communication", checkLogin(), canRead("communications"), companyCommunicationEmail)
app.post("/settings/communication", checkLogin(), canWrite("communications"), companyCommunicationEmail)


//LR Series Assign
const seriesAssign = require("./routes/companySettings/seriesAssign")
app.get("/settings/series-assign", checkLogin(), seriesAssign)
app.get("/settings/series-assign/get-godown", checkLogin(), seriesAssign)
app.post("/settings/series-assign/new", checkLogin(), seriesAssign)
app.post("/settings/series-assign/delete", checkLogin(), seriesAssign)
app.post("/settings/series-assign/stop", checkLogin(), seriesAssign)
app.post("/settings/series-assign/start", checkLogin(), seriesAssign)
app.get("/settings/series-assign/edit", checkLogin(), seriesAssign)

// Transactions ==================================================================================>
//Bookings =======================================================================================>
//lr new
const lr = require("./routes/transactions/booking/lorry-reciept")
app.get("/transactions/booking/lorry-reciept", checkLogin(), lr)
app.get("/getBranchSerial", checkLogin(), lr)
app.get("/getConsignorConsignee", checkLogin(), lr)
app.post("/transactions/booking/lorry-reciept/new", checkLogin(), lr)
app.get("/transactions/booking/lorry-reciepts", checkLogin(), lr)
app.post("/transactions/booking/lorry-reciepts/data", checkLogin(), lr)
app.post("/transactions/booking/lorry-reciept/update", checkLogin(), lr)
app.get("/transactions/booking/lorry-reciept/delete", checkLogin(), lr)
app.get("/transactions/booking/lorry-reciept/get-lr-detail", checkLogin(), lr)
app.get("/masters/rates/rate-master/get-rate", checkLogin(), lr)
app.get("/masters/rates/rate-master/get-rate-on", checkLogin(), lr)
app.get("/transactions/booking/lorry-reciepts/download" , checkLogin(), lr)


//Challan
const challan = require("./routes/transactions/booking/challan")
app.get("/transactions/booking/challan", checkLogin(), challan)
app.get("/transactions/booking/challan/get-lr-details", checkLogin(), challan)
app.get("/transactions/booking/challan/get-package-details", checkLogin(), challan)
app.post("/transactions/booking/challan/new", checkLogin(), challan)
app.get("/transactions/booking/challan/get-challan-detail", checkLogin(), challan)
app.post("/transactions/booking/challan/update", checkLogin(), challan)
app.get("/transactions/booking/challan/delete", checkLogin(), challan)
app.get("/transactions/booking/challan/get-vehicle-details", checkLogin(), challan)


const localCollectionChallan = require("./routes/transactions/booking/local-collection-challan")
app.get("/transactions/booking/local-collection-challan", checkLogin(), localCollectionChallan)
app.get("/transactions/booking/local-collection-challan/get-lr-data", checkLogin(), localCollectionChallan)
app.post("/transactions/booking/local-collection-challan/new", checkLogin(), localCollectionChallan)
app.get("/transactions/booking/local-collection-challan/edit", checkLogin(), localCollectionChallan)
app.post("/transactions/booking/local-collection-challan/edit", checkLogin(), localCollectionChallan)
app.post("/transactions/booking/local-collection-challan/delete", checkLogin(), localCollectionChallan)


const lorryArrival = require("./routes/transactions/delivery/lorry-arrival")
app.get("/transactions/delivery/lorry-arrival", checkLogin(), lorryArrival)
app.get("/transactions/delivery/lorry-arrival/get-challan-details", checkLogin(), lorryArrival)
app.post("/transactions/delivery/lorry-arrival/new", checkLogin(), lorryArrival)
app.get("/transactions/delivery/lorry-arrival/get-arrival-details", checkLogin(), lorryArrival)
app.post("/transactions/delivery/lorry-arrival/update", checkLogin(), lorryArrival)
app.get("/transactions/booking/lorry-arrival/delete", checkLogin(), lorryArrival)

//Delivery =========================================================================================>
const deliveryChallan = require("./routes/transactions/delivery/delivery-challan")
app.get("/transactions/delivery/delivery-challan", checkLogin(), deliveryChallan)
app.get("/transactions/delivery/delivery-challan/get-broker-details", checkLogin(), deliveryChallan)
app.get("/transactions/delivery/delivery-challan/get-package-details", checkLogin(), deliveryChallan)
app.post("/transactions/delivery/delivery-challan/new", checkLogin(), deliveryChallan)
app.get("/transactions/delivery/delivery-challan/edit", checkLogin(), deliveryChallan)
app.get("/transactions/delivery/get-lr-data", checkLogin(), deliveryChallan)
app.post("/transactions/delivery/delivery-challan/edit", checkLogin(), deliveryChallan)
app.post("/transactions/delivery/delivery-challan/delete", checkLogin(), deliveryChallan)
app.get("/transactions/delivery/delivery-challan/close", checkLogin(), deliveryChallan)
app.post("/transactions/delivery/delivery-challan/extend", checkLogin(), deliveryChallan)
app.post("/transactions/delivery/delivery-challan/close", checkLogin(), deliveryChallan)



//Delivery =========================================================================================>
const crossingChallan = require("./routes/transactions/delivery/crossing-challan")
app.get("/transactions/delivery/crossing-challan", checkLogin(), crossingChallan)
app.get("/transactions/delivery/crossing-challan/get-broker-details", checkLogin(), crossingChallan)
app.get("/transactions/delivery/crossing-challan/get-package-details", checkLogin(), crossingChallan)
app.post("/transactions/delivery/crossing-challan/new", checkLogin(), crossingChallan)
app.get("/transactions/delivery/crossing-challan/edit", checkLogin(), crossingChallan)
app.get("/transactions/delivery/crossing/get-lr-data", checkLogin(), crossingChallan)
app.post("/transactions/delivery/crossing-challan/edit", checkLogin(), crossingChallan)
app.post("/transactions/delivery/crossing-challan/delete", checkLogin(), crossingChallan)
app.get("/transactions/delivery/crossing-challan/close", checkLogin(), crossingChallan)
app.post("/transactions/delivery/crossing-challan/extend", checkLogin(), crossingChallan)
app.post("/transactions/delivery/crossing-challan/close", checkLogin(), crossingChallan)


//excess
const excess = require("./routes/transactions/delivery/excess")
app.get("/transactions/delivery/excess", checkLogin(), excess)
app.get("/transactions/delivery/excess/get-arrival-detail", checkLogin(), excess)
app.get("/transactions/delivery/excess/get-lr-detail", checkLogin(), excess)
app.post("/transactions/delivery/excess/new", checkLogin(), excess)
app.get("/transactions/delivery/excess/delete", checkLogin(), excess)
app.post("/transactions/delivery/excess/action", checkLogin(), excess)




//Transactions => Accounts ===============================================================================================>
//Freight Invoice
const freightInvoice = require("./routes/transactions/accounts/freight-invoice")
app.get("/transactions/accounts/freight-invoice", checkLogin(), freightInvoice)
app.get("/transactions/accounts/freight-invoice/get-lr", checkLogin(), freightInvoice)
app.get("/transactions/accounts/freight-invoice/get-lr-billing", checkLogin(), freightInvoice)
app.post("/transactions/accounts/freight-invoice/new", checkLogin(), freightInvoice)
app.get("/transactions/accounts/freight-invoice/edit", checkLogin(), freightInvoice)
app.post("/transactions/accounts/freight-invoice/edit", checkLogin(), freightInvoice)
app.get("/transactions/accounts/freight-invoice/delete", checkLogin(), freightInvoice)
app.get("/transactions/accounts/freight-invoice/download", checkLogin(), freightInvoice)
//Freight Memo
const freightMemo = require("./routes/transactions/accounts/freight-memo")
app.get("/transactions/accounts/freight-memo", checkLogin(), freightMemo)
app.post("/transactions/accounts/freight-memo/get-challan-details", checkLogin(), freightMemo)
app.post("/transactions/accounts/freight-memo/new", checkLogin(), freightMemo)
app.get("/transactions/accounts/freight-memo/edit", checkLogin(), freightMemo)
app.post("/transactions/accounts/freight-memo/edit", checkLogin(), freightMemo)
app.get("/transactions/accounts/freight-memo/delete", checkLogin(), freightMemo)
//Accounts ================================================================================================================>
//Reciepts
const reciepts = require("./routes/accounts/reciepts")
app.get("/accounts/reciepts", checkLogin(), reciepts)
app.get("/accounts/reciepts/get-details", checkLogin(), reciepts)
app.post("/accounts/reciepts/new", checkLogin(), reciepts)
app.get("/accounts/reciepts/edit", checkLogin(), reciepts)
app.post("/accounts/reciepts/edit", checkLogin(), reciepts)
app.get("/accounts/reciepts/delete", checkLogin(), reciepts)

//Contra
const contra = require("./routes/accounts/contra")
app.get("/accounts/contra", checkLogin(), contra)
app.post("/accounts/contra/new", checkLogin(), contra)
app.get("/accounts/contra/edit", checkLogin(), contra)
app.post("/accounts/contra/edit", checkLogin(), contra)
app.get("/accounts/contra/delete", checkLogin(), contra)


//Journal
const journal = require("./routes/accounts/journal")
app.get("/accounts/journal", checkLogin(), journal)
app.post("/accounts/journal/new", checkLogin(), journal)
app.get("/accounts/journal/edit", checkLogin(), journal)
app.post("/accounts/journal/edit", checkLogin(), journal)
app.get("/accounts/journal/delete", checkLogin(), journal)
//Payment
const payment = require("./routes/accounts/payment")
app.get("/accounts/payments", checkLogin(), payment)
app.get("/accounts/payments/get-details", checkLogin(), payment)
app.get("/accounts/payments/get-sub-ledger-details", checkLogin(), payment)
app.post("/accounts/payments/new", checkLogin(), payment)
app.get("/accounts/payments/edit", checkLogin(), payment)
app.post("/accounts/payments/edit", checkLogin(), payment)
app.get("/accounts/payments/delete", checkLogin(), payment)
//export pdf
const exportPDF = require("./routes/exports/pdf")
app.post("/export/pdf", checkLogin(), exportPDF)

//Reports =================================================================================================================>



//Accounts - Ledger
const reportsLedger = require("./routes/reports/accounts/ledger")
app.get("/reports/accounts/ledgers", checkLogin(), reportsLedger)
app.post("/reports/accounts/ledgers", checkLogin(), reportsLedger)

const reportpAndL = require("./routes/reports/accounts/pAndL")
app.get("/reports/accounts/profit-and-loss", checkLogin(), reportpAndL)
app.post("/reports/accounts/profit-and-loss", checkLogin(), reportpAndL)


const balanceSheet = require("./routes/reports/accounts/balanceSheet")
app.get("/reports/accounts/balance-sheet", checkLogin(), balanceSheet)
app.get("/reports/accounts/balance-sheet/export", checkLogin(), balanceSheet)


//Booking
const bookingregister = require("./routes/reports/booking/bookingRegister")
app.get("/reports/booking/booking-register", checkLogin(), bookingregister)
app.post("/reports/booking/booking-register", checkLogin(), bookingregister)



//Profile ===============================================================================>
//Overview
const profileOverview = require("./routes/profile/overview")
app.get("/profile/overview", checkLogin(), profileOverview)

//Settings
const profileSetting = require("./routes/profile/settings")
app.get("/profile/settings", checkLogin(), profileSetting)
app.post("/profile/settings", profileSetting)

//Security
const profileSecurity = require("./routes/profile/security")
app.get("/profile/security", checkLogin(), profileSecurity)
app.post("/profile/security/sms", checkLogin(), profileSecurity)
app.get("/profile/security/sms/verify", checkLogin(), checkOtpSent, profileSecurity)
app.post("/profile/security/sms/verify", checkLogin(), profileSecurity)
app.post("/profile/security/sms/disable", checkLogin(), profileSecurity)
app.post("/profile/security/googleAuth", checkLogin(), profileSecurity)
app.post("/profile/security/change-password", checkLogin(), profileSecurity)
app.post("/profile/security/change-email", checkLogin(), profileSecurity)

//Logs
const logs = require("./routes/profile/logs")
app.get("/profile/logs", checkLogin(), logs)
const remoteLogout = require("./routes/authentication/remoteLogout")
app.post("/profile/logs/remote-logout/:sessionToken", checkLogin(), remoteLogout)


//Activity Logs
const activityLogs = require("./routes/profile/activity-logs")
app.get("/profile/activity-logs", checkLogin(), activityLogs)
app.post("/profile/activity-logs", checkLogin(), activityLogs)


const branchSchema = require("./models/masters/locations/branch")
const userSchema = require("./models/authentication/user")
const godownSchema = require("./models/masters/locations/godowns")


// temporary branch change code for testing
app.get("/change-branch", async (req, res) => {
  const { branchId, godownId } = req.query
  const db = req.dbConnection
  const branch = db.model("branches", branchSchema)
  const userMODEL = db.model("users", userSchema)
  const godown = db.model("godowns", godownSchema)
  const session = await db.startSession()

  try {
    session.startTransaction()
    await godown.findByIdAndUpdate(req.user.godown.id, { $pull: { users: req.user.id } }).session(session)
    await branch.findByIdAndUpdate(req.user.branch.id, { $pull: { users: req.user.id } }).session(session)
    await godown.findByIdAndUpdate(godownId, { $push: { users: req.user.id } }).session(session)
    await branch.findByIdAndUpdate(branchId, { $push: { users: req.user.id } }).session(session)
    await userMODEL.findByIdAndUpdate(req.user.id, { branch: branchId, godown: godownId }).session(session)

    await session.commitTransaction()
    return res.sendStatus(200)



  } catch (err) {
    await session.abortTransaction()
    console.log(err)
    res.sendStatus(500)
  }
})





// Your Express app setup and routes go here
const port = 5000; // Define the port variable
server.listen(port, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Server Started Successfully on Port{${port}}`);
  }
});




