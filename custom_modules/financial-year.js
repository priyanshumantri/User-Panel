function getCurrentFinancialYear() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  // Check if the current month is April (month index 3) or later
  // If it's April or later, return the current year and the next year as the financial year
  // Otherwise, return the previous year and the current year as the financial year
  const startYear = currentDate.getMonth() >= 3 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;

  // Format the financial year as "2023-2024", "2024-2025", etc.
  const formattedFinancialYear = `20${String(startYear).slice(-2)}-20${String(endYear).slice(-2)}`;

  return formattedFinancialYear;
}



module.exports = getCurrentFinancialYear;
