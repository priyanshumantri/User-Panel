const groupSchema = require("../../models/masters/groups")
const ledgerSchema = require("../../models/masters/ledgers")
async function getLedgers(db, groupName) {
    const groups = db.model("groups", groupSchema)
    const ledgers = db.model("ledgers", ledgerSchema)
    const groupData = await groups.find({})
    let groupIDS = []
    for(const data of groupData) {
        //removing all space from data.name
        const mainName = data.name.replace(/\s/g, '').toLowerCase()
        if(mainName ==  groupName) {
            groupIDS.push(data.id)
        } else if(data.under !== "primary") {
            const underData = await groups.findById(data.under)
            const underName = underData.name.replace(/\s/g, '').toLowerCase()
            if(underName == groupName) {
                groupIDS.push(data.id)
            }
        }
    }

    const clientData = await ledgers.find({group : {$in : groupIDS}}).populate("group").populate("subLedgers")
    return clientData    
}

module.exports = getLedgers