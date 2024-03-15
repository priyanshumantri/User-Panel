function checkLoginSession() {
    return async function(req, res, next) {
        if(req.user) {
            if(req.user.financialYear === null) {
                return res.redirect("/select-session")
            } else { 
                next()
             }
        } else {
            res.redirect("/login")
        }
    }
}

module.exports = checkLoginSession