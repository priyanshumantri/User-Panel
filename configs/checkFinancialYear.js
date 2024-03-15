const financialYearSchema = require("../models/financialYear")
const getFinancialYear = require("../custom_modules/financial-year")
const getFinancialYearFromDate = require("../custom_modules/customFY")


function getCurrentFinancialYear() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
  
    let startYear, endYear;
  
    if (currentMonth >= 3) {
      // If the current month is April or later, the financial year started in the current year.
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      // If the current month is January to March, the financial year started in the previous year.
      startYear = currentYear - 1;
      endYear = currentYear;
    }
  
    return `${startYear}-${endYear}`;
  }
  

  
  function checkFinancialYear() {
    return async function(req, res, next) {
      const db = req.dbConnection;
      const fy = db.model("financial-years", financialYearSchema);
  
      // Get the current financial year
      const today = new Date();
      const nextFYStartDate = new Date(today.getFullYear(), 3, 1);
      const nextFYEndDate = new Date(nextFYStartDate.getFullYear() + 1, 2, 31);

      const nextFinancialYear = `${(nextFYStartDate.getFullYear()+1)}-${(nextFYEndDate.getFullYear()+1)}`;
      const currentFinancialYear = getCurrentFinancialYear();
      const currentFYData = await fy.findOne({ financialYear: currentFinancialYear });

      if (!currentFYData) { 
        const newFY = new fy({ 
          financialYear : currentFinancialYear
         })
          await newFY.save()
       }

       // code which checks if today is 28th March and if it is then it will create a new FY
        const currentMonth = today.getMonth();
        const currentDate = today.getDate();
        if(currentMonth === 2 && currentDate === 28) {
          const newFY = new fy({ 
            financialYear : nextFinancialYear
          })
          
        const newFYData =  await newFY.save()
        const previousFYData = await fy.findOne({ financialYear: currentFinancialYear });
        if(previousFYData) { 
          newFYData.seriesAssigned = previousFYData.seriesAssigned;

          for (const data of newFYData.seriesAssigned) {
            data.balance = data.end - data.start + 1;
          }
    
         } 
         await savedNewFY.save(); 

        }
        
      return next();
    };
  }
  
  
module.exports = checkFinancialYear