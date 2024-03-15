



function loginPageCheck(req, res, next) {
   if(req.session && req.session.user) {
    res.redirect("/dashboard")
   } else {
    next()
   }
}




module.exports =  {loginPageCheck}