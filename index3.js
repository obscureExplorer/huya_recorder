const { spawn } = require("child_process")
const { exec } = require("child_process")
const huya_danmu = require('../huya-danmu/index')
var format = require('date-format');

const myArgs = process.argv.slice(2);
const defaultRoomId = myArgs[0];
const donwlodDir = myArgs[1];

var log4js = require("log4js");
var logger = log4js.getLogger();
logger.level = "info";
log4js.configure({
    appenders: { output: { type: "file", filename: "output.log", maxLogSize: 10 * 1024 * 1024 } },
    categories: { default: { appenders: ["output"], level: "info" } }
});

var express = require('express')
var app = express()

let isLive = false;
let output = ""
var proc = null
let terminateManually = false;
let liveId = -1;

const danmuClient = new huya_danmu(defaultRoomId)

//调用ffmpeg进行录制
function startRecord(msg) {
    let liveInfo = msg.tNotice;
    //生成输出文件名
    let outputFileName = liveInfo.sNick + '-' + liveInfo.iRoomId + "的huya直播" + format.asString('yyyy-MM-dd_hh.mm.ss') + ".ts";
    let line = liveInfo.vStreamInfo.value[0];
    let liveUrl = line.sFlvUrl + "/" + line.sStreamName + "." + line.sFlvUrlSuffix + "?" + line.sFlvAntiCode

    proc = spawn("ffmpeg", ["-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36", "-i", liveUrl, "-c", "copy", outputFileName], { cwd: donwlodDir })
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
        //还在直播且不是因为主动终止，说明是因为异常退出的，要重新录制
        if (isLive && !terminateManually) {
            danmuClient.getLivingInfo(startRecord)
        }
    })
}

//初始化弹幕模块，用来监听是否开播和下播
danmuClient.on('message', msg => {
    var json;
    switch (msg.type) {
        case 'beginLive':
            json = JSON.stringify(msg);
            logger.info(json);
            //收到上播消息
            //判断是开始直播还是更新线路信息
            if (liveId != msg.lLiveId) {
                output = "";
                isLive = true;
                startRecord(msg.info)
                liveId = msg.lLiveId
            }
            break
        case 'endLive':
            //收到下播消息
            json = JSON.stringify(msg);
            logger.info(json)

            isLive = false;
            liveId = -1;
            break;
    }
})
danmuClient.on('connect', () => {
    logger.info(`已连接huya ${defaultRoomId}房间弹幕~`);

    //判断连接弹幕服务器时，主播是否正在直播。如果是，则马上开启录制。
    danmuClient.getLivingInfo(function (msg) {
        isLive = msg.bIsLiving == 1 ? true : false;
        if (isLive)
            startRecord(msg);
    })
})

danmuClient.on('error', e => {
    logger.error(e)
    if(e.message == 'Fail to get info'){
        danmuClient.start()
    }
})

danmuClient.on('close', () => {
    logger.info('开始断线重连')
    danmuClient.start()
})

danmuClient.start()

app.get("/start", function (req, res) {
    if (proc != null) {
        res.send("Already started");
        return;
    }
    output = ""
    terminateManually = false
    danmuClient.getLivingInfo(startRecord);
    res.send("OK")
})
//查看磁盘用量
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
    terminateManually = true;
    proc.stdin.setEncoding('utf-8')
    proc.stdin.write("q")
    proc.stdin.end()
    proc = null
    res.send("OK")
})

var mongoClient = require("mongodb").MongoClient;
const url = 'mongodb://localhost:27017';

let huyaDB = null;
mongoClient.connect(url, function (err, dbClient) {
    if (err) throw err;
    logger.info("Connected to MongoDB");
    huyaDB = dbClient.db("huya");
});


app.get("/getLatestChatInfos", function (req, res) {
    if (!huyaDB) {
        res.send("Not ready yet")
        return;
    }
    huyaDB.collection(defaultRoomId).find({}, { projection: { 'from.name': 1, 'name': 1, 'type': 1, 'content': 1, 'time': 1 } }).sort({ time: -1 }).limit(10)
        .toArray(function (err, result) {
            result.forEach(item => item.time = (new Date(item.time).toLocaleString()))
            res.send(result)
        })
})

app.get("/restart", function (req, res) {
    if (!proc) {
        res.send("Process is not running right now.")
        return;
    }
    proc.stdin.setEncoding('utf-8')
    proc.stdin.write("q")
    proc.stdin.end()
    proc = null
    res.send("OK")
})

var port = 8081
var server = app.listen(port)
logger.info('Server listened on: ' + port)
