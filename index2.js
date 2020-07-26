const { spawn } = require("child_process")
const { exec } = require("child_process")

var express = require('express')
var app = express()

let output = ""
var proc = null
let retryCount = 0;
let earlyTerminated = false;

function startRecord(roomId, retryCount) {
    proc = spawn("java", ["-Dfile.encoding=utf-8", "-jar", "BiliLiveRecorder.jar", "debug=false&check=false&delete=false&liver=huya&id=" + roomId + "&retry=3&qn=-1&qnPri=蓝光4M>超清>高清>流畅"], { cwd: '/home/ubuntu' })
    proc.stdout.on("data", data => {
        output += data
    })

    proc.stderr.on("data", data => {
        output += data
    })

    proc.on('error', (error) => {
        output = `error: ${error.message}`
    })

    proc.on("exit", () => {
        proc = null

        if (!earlyTerminated) {
            setTimeout(function () {
                if (retryCount++ < 2)
                    startRecord(roomId, retryCount)
            }, 1000);
        }

    })
}

let set = new Set();
app.get("/start", function (req, res) {

    if (proc != null) {
        res.send("Already started");
        return;
    }

    output = ""
    retryCount = 0
    earlyTerminated = false

    let roomId = req.query.roomId;
    startRecord(roomId == null || roomId == undefined ? "lovetuleisi" : roomId, retryCount)

    res.send("OK,pid is " + proc.pid)
})

app.get("/disk_usage", function (req, res) {
    exec("df -h", (error, stdout, stderr) => {
        if (error) {
            res.send(error.message)
            return
        }
        if (stderr) {
            res.send(stderr)
            return
        }
        res.send("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>data</title></head><body>" + stdout.replace(/\n/g, '<br/>') + '</body></html>')
    })
})

app.get("/status", function (req, res) {
    let content = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>data</title></head><body>" + output.replace(/\n/g, '<br/>') + '</body></html>';
    res.send(content)
})

app.get("/stop", function (req, res) {
    if (!proc) {
        res.send("Process is not running right now.")
        return;
    }
    earlyTerminated = true;
    //Since SIGNAL is not supported, the following line is commented.
    //proc.kill("SIGTERM");
    proc.stdin.setEncoding('utf-8')
    proc.stdin.write("stop")
    proc.stdin.end()
    proc = null
    res.send("OK")
})

var mongoClient = require("mongodb").MongoClient;
const url = 'mongodb://localhost:27017';

let huyaDB = null;
mongoClient.connect(url, function (err, dbClient) {
    if (err) throw err;
    console.log("Connected to MongoDB");
    huyaDB = dbClient.db("huya");
});

/*
var cors = require('cors')
app.get("/getChatInfo", cors(), function (req, res) {
    if (!huyaDB) {
        res.send("Not ready yet")
        return;
    }
    var startTime = new Date();
    startTime.setDate(startTime.getDate() - 1)
    startTime.setHours(19, 0, 0)
    var queryParams = {
        time: { $gt: startTime.getTime() },
        type: 'chat'
    }
    huyaDB.collection("lovetuleisi").find(queryParams, { projection: { 'from.name': 1, 'type': 1, 'content': 1, 'time': 1 } }).sort({ time: 1 })
        .toArray(function (err, result) {
            res.send(result);
        })
})*/


app.get("/getLatestChatInfos", function (req, res) {
    if (!huyaDB) {
        res.send("Not ready yet")
        return;
    }
    huyaDB.collection("lovetuleisi").find({}, { projection: { 'from.name': 1,'name' : 1 ,'type': 1, 'content': 1, 'time': 1 } }).sort({ time: -1 }).limit(10)
        .toArray(function (err, result) {
            result.forEach(item => item.time = (new Date(item.time).toLocaleString()))
            res.send(result)
        })
})

app.get("/restartDanMuCrawler", function (req, res) {

    var proc2 = spawn("sh", ["restart.sh"], { cwd: '/home/ubuntu/danmu-crawler' })
    proc2.stdout.on("data", data => {
        output += data
    })

    proc2.stderr.on("data", data => {
        output += data
    })

    proc2.on('error', (error) => {
        output = `error: ${error.message}`
    })

    res.send("ok")

})

app.get("/reset",function(req, res){
    output = 0;
    res.send("reset completed");
})

var port = 8081
var server = app.listen(port)
console.log('Server listened on: ' + port)
