// Middleware function to check if OTP has been sent
function checkOtpSent(req, res, next) {
    // Check if the OTP has been sent for the current user
    if (req.session && req.session.otpSent === true) {
      // OTP has been sent, allow access to the page
      next();
    } else if(req.otpSent === true) {
      next()
    } else {
      // OTP has not been sent, redirect to a different page (e.g., dashboard)
     next() // Change '/dashboard' to the appropriate URL
    }
  }

  module.exports = checkOtpSent