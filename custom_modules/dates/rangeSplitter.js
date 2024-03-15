function splitDateRange(dateRangeString) {
    // Split the date range string into start date and end date strings
    const dateStrings = dateRangeString.split(" - ");
    const startDateString = dateStrings[0];
    const endDateString = dateStrings[1];

    // Return an object containing start date and end date strings
    return {
        startDate: startDateString,
        endDate: endDateString
    };
}

module.exports = splitDateRange;