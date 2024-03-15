

const userSchema = require("../models/authentication/user")
const activityLogSchema = require("../models/authentication/activityLogs")


function activityLogger(req, activity, status) {
    const db = req.dbConnection
    const activityLogs = db.model("activity-logs", activityLogSchema)
    const user = db.model("users", userSchema)
    const newActivity = new activityLogs({
        user: req.user.id,
        activity: activity,
        sessionToken: req.session.sessionToken,
        status : status
    });

    newActivity.save().then((data) => {
        const index = req.user.loginSessions.findIndex((element) => element.sessionToken === req.session.sessionToken);
        if (index !== -1) {
            const updateQuery = {
                $push: {
                    [`loginSessions.${index}.activityLogs`]: data.id,
                },
            };
            user.findByIdAndUpdate(req.user.id, updateQuery, (err, updatedUser) => {
                if (err) {
                    console.error(err);
                }
            });
        }
    });
}


module.exports = {activityLogger}