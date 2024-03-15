const express = require("express")
const Route = express.Router()
const activityLogsSchema = require("../../models/authentication/activityLogs")


Route.get("/profile/activity-logs", (req, res)=> {
    const db = req.dbConnection
    const activityLogs = db.model("activity-logs", activityLogsSchema)
    activityLogs.find({user : req.user.id}, (err, data)=> {
        if(err) {
            console.log(err)
        } else {
            res.render("profile/activity-logs", { data : data})
        }
    })
})

Route.post("/profile/activity-logs", (req, res)=> {
    const db = req.dbConnection
    const activityLogs = db.model("activity-logs", activityLogsSchema)
    activityLogs.find({ sessionToken: req.body.token }, (err, data) => {
        if (err) {
            console.log(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            // Create an array to store filtered data
            const filteredDataArray = data.map((log) => ({
                activity: log.activity,
                status: log.status,
                time: log.timestamp,
            }));
    
            res.json(filteredDataArray);
        }
    });
    
})

module.exports = Route