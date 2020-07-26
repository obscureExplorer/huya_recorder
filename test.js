var mongoClient = require("mongodb").MongoClient;
const url = 'mongodb://localhost:27017';

let huyaDB = null;
mongoClient.connect(url, function (err, dbClient) {
    if (err) throw err;
    console.log("Connected to MongoDB");
    huyaDB = dbClient.db("huya");

    huyaDB.collection("lovetuleisi").find({}, { projection: { 'from.name': 1, 'type': 1, 'content': 1, 'time': 1 } }).sort({ time:-1 }).limit(10)
    .toArray(function (err, result) {
        result.forEach(item => item.time = (new Date(item.time).toLocaleString()))
    })

});

