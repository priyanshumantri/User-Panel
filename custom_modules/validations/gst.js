const dotenv = require('dotenv')
const gstSchema = require('../../models/central/gst');
function checksum(gstNumber) {
    const regTest = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber);

    if (regTest) {
        //getting 2nd last character
        const secondLast = gstNumber.charAt(gstNumber.length - 2);
        if(secondLast != "Z") {
            return false
        }
        //getting first 2 characters
        const firstTwo = gstNumber.substring(0, 2);
        if (parseInt(firstTwo) > 35) {
            return false;
        } 

        //returning true if all conditions are met
        return true;
    } else {
        return false;
    }
}





async function validateGSTNumber (company, db, session, gstNumber, at) {

    if(gstNumber === "" && company.validations[at].gst === true) {
        return {error : true, message : "GST Number is Mandatory"};
    }
    if(gstNumber === "" && company.validations[at].gst === false) {
        return true;
    }
    

    //regex check
    const checksumResult = checksum(gstNumber);
    if (checksumResult === false) {
        return {
            error: true,
        };
    } 



    const gstM = db.model('gst-numbers', gstSchema);
    
    const ifUsed = await gstM.findOne({gst : gstNumber, used : true});
    if(ifUsed) {
        return {
            error: true,
            message: "GST Number already used"
        }
    }
    
    
    const data = await gstM.findOne({gst : gstNumber, used : false});
    if(data) {
       
            return {address : data.address, state : data.state, name : data.name, pan : data.pan}
     
    }

    //api checks
    const url = ' https://appyflow.in/api/verifyGST';
    return fetch(`https://appyflow.in/api/verifyGST?key_secret=${process.env.APPYFLOW_API_KEY}&gstNo=${gstNumber}`).then((res)=> {
        return res.json().then(async(data)=> {
            
        let address = data.taxpayerInfo.pradr.addr.bno + ", " + data.taxpayerInfo.pradr.addr.st + ", " + data.taxpayerInfo.pradr.addr.loc + ", " + data.taxpayerInfo.pradr.addr.dst + " - " + data.taxpayerInfo.pradr.addr.pncd + ", " + data.taxpayerInfo.pradr.addr.stcd;
        let state = data.taxpayerInfo.pradr.addr.stcd;
        let name = data.taxpayerInfo.tradeNam;
        let pan = data.taxpayerInfo.panNo;
            const newData = await updateGSTVerified(db, session, gstNumber, at, address, state, name, pan)
            return newData
        })
    }).catch((err)=> {
        console.log(err)
        res.sendStatus(500)
    })
}

//used in validateGSTNumber function to update gst number in central database after it is verified
async function updateGSTVerified(db, session, gst, at, address, state, name, pan) {
    const gstM = db.model('gst-numbers', gstSchema);
    try {
        const newGST = new gstM({
            gst: gst,
            used: false,
            at : at,
            address: address,
            state: state,
            name: name,
            pan: pan
        });
        const data = await newGST.save({session});
        await newGST.save();
        return data
    } catch (error) {
        console.log(error);
    }
}

//updating gst number after it is used
async function updateGST(db, session, gst) {
    const gstM = db.model('gst-numbers', gstSchema);
    try {
        const data = await gstM.findOne({gst : gst}).session(session);
        data.used = true;
        await data.save();
        return true
    } catch (error) {
        console.log(error);
    }
}

//updating gst used as false in edit/delete routes 
async function updateGSTUsedFalse(db, session, gst) {
    const gstM = db.model('gst-numbers', gstSchema);
    try {
        const data = await gstM.findOne({gst : gst}).session(session);
        data.used = false;
        await data.save();
        return true
    } catch (error) {
        console.log(error);
    }
}


module.exports = {validateGSTNumber, updateGST, updateGSTUsedFalse}