const mobileSchema = require('../../models/central/mobile');
async function validateMobile(company, db, session, mobile, at) {
    if(mobile === "" && company.validations[at].mobile === true) {
        return {status : false, message : "Mobile Number is Mandatory"};
     }
        if(mobile === "" && company.validations[at].mobile === false) {
            return true;
        }

        //checking if firsy digit is 0 of mobile number if yes then remove it
        if(mobile.charAt(0) === "0") {
            mobile = mobile.slice(1)
        }

        //checking if first digit is + of mobile number if yes then remove it
        if(mobile.charAt(0) === "+") {
            mobile = mobile.slice(3)
        }
    // Check if mobile is a number
    let regTest = /^\d{10}$/.test(mobile)
    if(!regTest){
        return {status : false, message : "Invalid mobile number"}
    }
    const apiKey = process.env.BIGDATA_API_KEY


    //checking in central mobile database
    const mobileM = db.model('mobile-numbers', mobileSchema);
    const data = await mobileM.findOne({mobile: mobile, used : true}).session(session)
    if(data){
        let message 
        if(data.at == "ledgers") {
            message = "Mobile number already exists at ledgers"
        }
        if(data.at == "users") {
            message = "Mobile number already exists for users"
        }
        if(data.at == "brokers") {
            message = "Mobile number already exists for brokers"
        }
        if(data.at == "owners") {
            message = "Mobile number already exists for owners"
        }
        return {status : false, message : message}
    }

    const ifMobileExists = await mobileM.findOne({mobile: mobile, used : false}).session(session);
    if(ifMobileExists) {
        return true
    }

    //api validation for mobile
   return fetch(`https://api-bdc.net/data/phone-number-validate?number=${mobile}&countryCode=IN&key=${apiKey}`, {
        method: 'GET',
    }).then((res)=> {
        return res.json().then(async(data)=> {
            if(data.isValid && data.lineType == "MOBILE") {
                await updateMobileVerified(db, session, mobile, at)
                return {status : true}
            } else {
                console.log(data.isValid)
                console.log("Mobile is invalid")
                return {status : false, message : "Please enter a valid mobile number"};
            }
        })
    }).catch((err)=> {
        console.log(err)
       return res.sendStatus(500)
    })

}

//used to update mobile number after it is used
async function updateMobile(db, session,  mobile) {
    const mobileM = db.model('mobile-numbers', mobileSchema);
    try {
        const data = await mobileM.findOne({mobile : parseInt(mobile)}).session(session);
        data.used = true;
       await data.save();
        if(data) {
            return true
        }

    } catch (error) {
        console.log(error)
        return {status : false, message : "Somethging went wrong, please try again later"};
    }
}


// used in validateMobile function to update mobile number after its verfiied
async function updateMobileVerified(db, session, mobile, at) {
    const mobileM = db.model('mobile-numbers', mobileSchema);
    try {
        const newMobile = new mobileM({
            mobile: parseInt(mobile),
            at: at,
            used : false
        });
        const data = await newMobile.save({session});
        if(data) {

        return true
        }
    } catch (error) {
        console.log(error)
        return {status : false, message : "Somethging went wrong, please try again later"};
    }
}

// used in edit / delete route so that mobile number can be used again if it is not used
async function updateMobileUsedFalse(db, session, mobile) {
    const mobileM = db.model('mobile-numbers', mobileSchema);
    try {
        const data = await mobileM.findOne({mobile : mobile}).session(session);
        data.used = false;
        await data.save();
        if(data) {
            return true
        }

    } catch (error) {
        console.log(error)
        return false
    }
}
module.exports = {validateMobile, updateMobile, updateMobileUsedFalse}