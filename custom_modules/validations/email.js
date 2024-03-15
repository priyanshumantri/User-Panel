// emailVerification.js
const axios = require('axios');
const emailSchema = require('../../models/central/email');
async function verifyEmail(company, db, session, email, at) {
    try {
        if(email === "" && company.validations[at].email === true) {
            return {status : false, message : "Email Address is mandatory"};
         } 
         if(email === "" && company.validations[at].email === false) {
            return true;
            }
        //regex check
        const emailRegex = new RegExp(/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/);
        if (!emailRegex.test(email)) {
            return {status : false, message : "Please enter a valid email address"};
        }


        //central database check
        const emailM = db.model('emails', emailSchema);
        const data = await emailM.findOne({ email: email, used : true }).session(session);
        if(data) {
           let message
           if(data.at === "ledgers") {
                message = "This email is already registered in a ledger";
              }
                if(data.at === "users") {
                    message = "This email is already registered for a user";
                }
                if(data.at === "brokers") {
                    message = "This email is already registered for a broker";
                }
                if(data.at === "owners") {
                    message = "This email is already registered for an owner";
                }
           return {status : false, message : message};
        }

        const ifEmailExists = await emailM.findOne({email: email, used : false}).session(session);
        if(ifEmailExists) {
            return true;
        }

      //api checks
        const apiKey = process.env.NEVERBOUNCE_API_KEY;
        const apiUrl = `https://api.neverbounce.com/v4/single/check?key=${apiKey}&email=${email}`;


        return fetch(apiUrl, {
            method: 'POST',
        }).then((res)=> {
            return res.json().then(async(data)=> {
                const found = data.flags.includes('smtp_connectable');

                if(data.status === "success" && data.result === "valid") {
                   await updateEmailVerified(db, session, email, at)
                    return {status : true}
                } else if(data.status === "success" && found ) {
                    await updateEmailVerified(db, session, email, at)
                    return {status : true}
                } else {
                    return {status : false, message : "Please enter a valid email address"};
                }
            })
        }).catch((err)=> {
            console.log(err)
            res.sendStatus(500)
        })

        
    } catch (error) {
        // Handle errors, e.g., network issues, request failures
        console.log(error)
        return {status : false, message : "Somethging went wrong, please try again later"};
    }
}


async function updateEmail(db, session, email) {
    const emailM = db.model('emails', emailSchema);
        try {
            const data = await emailM.findOne({email: email.trim().toLowerCase()}).session(session);
            data.used = true;
            await data.save();
            if(data) {
                return true;
            }
        } catch (error) {
            console.log(error)
            return false;
        }
    }

async function updateEmailVerified(db, session, email, at) {
const emailM = db.model('emails', emailSchema);
    try {
        const newEmail = new emailM({
            email: email.trim().toLowerCase(),
            at: at,
            used : false
        });
        await newEmail.save({session});
        return true;
    } catch (error) {
        console.log(error)
        return false;
    }
}

async function updateEmailUsedFalse(db, session, email) {
    const emailM = db.model('emails', emailSchema);
    try {
        const data = await emailM.findOne({email: email.trim().toLowerCase()}).session(session);
        data.used = false;
        await data.save();
        if(data) {
            return true;
        }
    } catch (error) {
        console.log(error)
        return false;
    }
}

module.exports = {
    verifyEmail,
    updateEmail,
    updateEmailUsedFalse
};
