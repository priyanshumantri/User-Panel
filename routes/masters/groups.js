const express = require('express');
const Route = express.Router();
const groupSchema = require('../../models/masters/groups');
const ledgerSchema = require('../../models/masters/ledgers');
const mongoose = require('mongoose');
function isValidObjectId(str) {
    return mongoose.Types.ObjectId.isValid(str);
}


Route.get('/masters/groups', async (req, res) => { 
    const db = req.dbConnection;
    const groups = db.model('groups', groupSchema)
    const groupData = await groups.find()   

    for(const data of groupData)  {
        data.underID = data.under
        if(isValidObjectId(data.under)) {
            const underGroupData = await groups.findById(data.under)
            data.under = underGroupData.name
            if(isValidObjectId(underGroupData.under)) {
                const underUnderGroupData = await groups.findById(underGroupData.under)
                data.info = underUnderGroupData.name
            }else {
                data.info = underGroupData.under
            }
           
        }
        
    }
    res.render('masters/groups', {groupData: groupData});
})

Route.post("/masters/groups/new", async (req, res) => {
    const db = req.dbConnection
    const groups = db.model("groups", groupSchema)
    const session = await db.startSession()

    try {
        session.startTransaction()
        const { groupName, underGroup } = req.body
        if (!groupName || !underGroup ) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please fill all the fields" })
        }

    


        const newGroup = new groups({
            name: groupName,
            under: underGroup,
            lock: false
        })
        newGroup.save({ session })
  



        await session.commitTransaction()
        res.sendStatus(200)
    } catch (err) {
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)
    } finally {
        session.endSession()
    }

})


Route.post("/masters/groups/delete", async (req, res) => {
    const db = req.dbConnection;
    const groups = db.model("groups", groupSchema);
    const ledgers = db.model("ledgers", ledgerSchema);
    const session = await db.startSession();

    try {
        session.startTransaction();
        const { id } = req.body;
        if (!id) {
           return res.sendStatus(500);
        }

        // check if group exists
        const groupData = await groups.findById(id);
        if (!groupData) {
            await session.abortTransaction();
            return res.status(400).send({ message: "Group not found" });
        }

        // check if group has ledgers
        const ledgerData = await ledgers.find({ group: id });
        if (ledgerData.length > 0) {
            await session.abortTransaction();
            return res.status(400).send({ message: "Group has Ledgers" });
        }

        //check if group has subgroups
        const subgroupData = await groups.find({ under: id });
        if (subgroupData.length > 0) {
            await session.abortTransaction();
            return res.status(400).send({ message: "Group has Sub Groups" });
        }

        //check if group is locked
        if (groupData.lock) {
            await session.abortTransaction();
            return res.status(400).send({ message: "Group is Locked" });
        }


        await groups.findByIdAndDelete(id, { session });

        await session.commitTransaction();
        res.sendStatus(200);
    } catch (err) {
        await session.abortTransaction();
        console.log(err);
        res.sendStatus(500);
    } finally {
        session.endSession();
    }

})

Route.post("/masters/groups/edit", async(req, res)=> {
    const db = req.dbConnection;
    const groups = db.model("groups", groupSchema);
    const {id, groupName, underGroup } = req.body;
    const groupData = await groups.findById(id);
    groupData.name = groupName;
    groupData.under = underGroup;
    await groupData.save();
    return res.sendStatus(200);
})
module.exports = Route;