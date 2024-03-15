const company = require("../models/settings/company")
const branches = require("../models/masters/locations/branch")
const user = require("../models/authentication/user")
const roleSchema = require("../models/authentication/roles")
const godownSchema = require("../models/masters/locations/godowns")
const fySchema = require("../models/financialYear")
function sendData() {
    return async function(req, res, next) {
        const db = req.dbConnection;
        const companyUP = db.model("companies", company);
        const branchesUP = db.model("branches", branches);
        const usersUP = db.model("users", user)
        const rolesUP = db.model("roles", roleSchema)
        const godown = db.model("godowns", godownSchema)
        const companyData = await companyUP.findOne({});
        const branchData = await branchesUP.find({});
        const fy = db.model("financial-years", fySchema)
        const godownData = await godown.find({})
        if (!companyData) {
           return res.send("Please Contact Administrator");
        } else if(companyData.active === false) {
           return res.send("Please Provide Software Provider")
        } else {
            res.locals.company = companyData;
            res.locals.branch = branchData;
            res.locals.message = req.flash;
            res.locals.godown = godownData
            // Safely set res.locals.user
            if (req.session && req.session.userID) {
              
                const userData = await usersUP.findById(req.session.userID).populate("role").populate("branch").populate("godown")
                const fyData = await fy.findById(userData.financialYear)
                res.locals.user = userData
                req.user = userData
                req.company = companyData
                res.locals.financialYear = {fy : fyData ? fyData.financialYear : null}
               
            }
            
            next()
        }

       
    }
}


module.exports = sendData