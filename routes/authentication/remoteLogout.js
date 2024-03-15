const express = require("express")
const Route = express.Router()

// Route for remote logout of a specific device session
Route.post("/profile/logs/remote-logout/:sessionToken", async (req, res) => {
    try {
        const sessionToken = req.params.sessionToken;
        const user = req.user;

        // Find the session in the loginSessions array
        const sessionIndex = user.loginSessions.findIndex(s => s.sessionToken === sessionToken);

        if(sessionToken === req.session.sessionToken) {
            return res.status(400).send({message : "You Cannot Logout Yourself From Here"})
        }else if (sessionIndex !== -1) {
            // Mark the session as inactive
            user.loginSessions[sessionIndex].isActiveSession = false;
            
            await user.save();

            // Respond with a success status
            return res.sendStatus(200);
        } else {
            // Session not found
            return res.status(400).send({message : "Status Not Found"})
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send("Internal Server Error");
    }
});


module.exports = Route