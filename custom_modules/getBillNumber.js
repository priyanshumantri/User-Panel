function calculateNextBillNumber(startValue, endValue, balance) {
    const totalNumber = endValue - startValue + 1;
    const nextBillNumber = startValue + totalNumber - balance;
    return nextBillNumber;
  }

  module.exports = calculateNextBillNumber