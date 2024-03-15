const dotenv = require('dotenv')
const panSchema = require('../../models/central/pan');
function checksum(pan) {
    const regTest = new RegExp(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/);

    if (regTest.test(pan)) {
        return true;
    } else {
        console.log("Invalid PAN Number")
        return false;
    }
}





async function validatePANNumber (company, pan, at) {
    if(pan === "" && company.validations[at].pan === true) {
        return {status : false, message : "PAN Number is Mandatory"};
    }
    if(pan === "" && company.validations[at].pan === false) {
        return true;
    }
    //regex check
    const checksumResult = await checksum(pan);
    if (checksumResult === false) {
        return {
            status : false,
            message : "Invalid PAN Number"
        };
    } else {
        return true
    }
}

module.exports = validatePANNumber;
