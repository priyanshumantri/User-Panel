
function getFinancialYearFromDate(dateString) {
    const parts = dateString.split('-');
    if (parts.length !== 3) {
      return 'Invalid Date Format';
    }
  
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
  
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return 'Invalid Date Format';
    }
  
 
  
    // Determine the financial year based on the provided date
    const startYear = month >= 4 ? year : year - 1;
    const endYear = startYear + 1;
  
    // Format the financial year as "2023-2024", "2024-2025", etc.
    const formattedFinancialYear = `20${String(startYear).slice(-2)}-20${String(endYear).slice(-2)}`;





    return formattedFinancialYear;
  }

  
  module.exports = getFinancialYearFromDate