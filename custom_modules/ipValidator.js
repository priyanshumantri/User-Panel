function isValidIP(ip) {
    // Use a regular expression to match valid IPv4 or IPv6 addresses
    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    const ipv6Regex = /^(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}$/i;
  
    if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
      return true;
    }
  
    return false;
  }


  module.exports = isValidIP