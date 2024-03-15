const fySchema = require("../models/financialYear")

async function getPrintNumber(db, user, info) {
    const fy = db.model("financial-years", fySchema)
    const fyData = await fy.findOne({ _id: user.financialYear })
    
    if (user.godown.serialToUse === "godown") {
        const array = _.get(fyData, info, [])
        const filtered = array.find(element => element.location.toString() === "godown" && element.godown.toString() === user.godown.id.toString())
        
        if (filtered) {
            if (filtered.track.length === 0) {
                return 1
            } else {
                return Math.max.apply(null, filtered.track) + 1
            }
        } else {
            const newObject = {
                location: "godown",
                godown: user.godown.id,
                branch: null,
                track: []
            }
            array.push(newObject)
            await fyData.save()
            return 1
        }
    } else if (user.godown.serialToUse === "branch") {
        const array = _.get(fyData, info, [])
        const filtered = array.find(element => element.location.toString() === "branch" && element.branch.toString() === user.branch.id.toString() && element.godown.toString() === user.godown.id.toString())
        if (filtered) {
            if (filtered.track.length === 0) {
                return 1
            } else {
                return Math.max.apply(null, filtered.track) + 1
            }
        } else {
            const newObject = {
                location: "branch",
                godown: user.godown.id,
                branch: user.branch.id,
                track: []
            }
            array.push(newObject)
            await fyData.save()
            return 1
        }

    } else {
        return 1
    }
}

const _ = require('lodash');

async function updatePrintNumber(db, session, user, infoPath, lrNumber) {
    const fy = db.model("financial-years", fySchema);
    const fyData = await fy.findOne({ _id: user.financialYear }).session(session);

    let filtered;
    let serial;

    if (user.godown.serialToUse === "godown") {
        const array = _.get(fyData, infoPath, []);
       filtered = array.find(element => element.location.toString() === "godown" && element.godown.toString() === user.godown.id.toString())
        
        serial = user.godown.serial;
    } else if (user.godown.serialToUse === "branch") {
        const array = _.get(fyData, infoPath, []);
        filtered = array.find(element => element.location.toString() === "branch" && element.branch.toString() === user.branch.id.toString() && element.godown.toString() === user.godown.id.toString())
        
        serial = user.branch.serial;
    } else if (user.godown.serialToUse === "assigned") {
        await session.abortTransaction();
        return res.status(400).send({ message: "Please Code for Using Assigned Series" });
    }

    const alreadyUsed = filtered.track.find(element => element === parseInt(lrNumber));

    if (alreadyUsed) {
        const temp = Math.max(...filtered.track) + 1;
        filtered.track.push(temp);
    } else {
        filtered.track.push(parseInt(lrNumber));
    }

    await fyData.save();
    return `${serial}-${filtered.track[filtered.track.length - 1]}`;
}




module.exports = {getPrintNumber, updatePrintNumber}