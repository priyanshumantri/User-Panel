function clientChecker() {
    return function(req, res, next) {
        const subdomain = req.subdomains[0]
        req.db = subdomain
        return next()
    }
}


module.exports = clientChecker