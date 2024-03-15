const mongoose = require("mongoose");

// Create a map to store connections
const connections = new Map();

// Function to connect to the MongoDB database
function connectDB() {
  return function (req, res, next) {
    // Check if the connection for the specific database exists in the map
    if (!connections.has(req.db)) {
      // If connection doesn't exist, create a new one
      const client = mongoose.createConnection(
        `mongodb+srv://meghacargoservice:LaLaMaN%405468%40LaLaMaN@test.pop9auc.mongodb.net/${req.db}?retryWrites=true&w=majority`,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useFindAndModify: false,
          poolSize: 10, // Set the size of the connection pool
        }
      );

      // Store the connection in the map
      connections.set(req.db, client);

      // Log when connected
      client.on('connected', function () {
        console.log('Mongoose default connection open to ' + req.db);
        req.dbConnection = connections.get(req.db);
        next();
      });

      // Log when disconnected
      client.on('disconnected', function () {
        console.log('Mongoose ' + req.db + ' connection disconnected');
      });

      // If the Node process ends, close the Mongoose connection
      process.on('SIGINT', function () {
        client.close(function () {
          console.log(req.db + ' connection disconnected through app termination');
          process.exit(0);
        });
      });
    } else {
      // If connection exists, retrieve it from the map
      req.dbConnection = connections.get(req.db);
      next();
    }
  };
}

module.exports = connectDB;
