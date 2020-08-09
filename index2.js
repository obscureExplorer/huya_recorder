const { spawn } = require("child_process")
const { exec } = require("child_process")
const huya_danmu = require('../huya-danmu/index')
const request = require('request-promise')

var express = require('express')
var app = express()

let isLive = false;
let output = ""
var proc = null
let earlyTerminated = false;

const r = request.defaults({ json: true, gzip: true, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36' } })
//判断当前开播状态
async function isLiveOrNot(){
    let body = await r({
        url: `https://www.huya.com/lovetuleisi`,
        agent: this._agent
    })
    let roomData = JSON.parse(body.match(/var TT_ROOM_DATA =(.*?);var TT_.{0,18}=/)[1])
    if(roomData.state === 'ON'){
        isLive = true;
        //判断当前是否在录制
        exec("jps", (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            if((/^.+\n$/.test(stdout))){
                startRecord("lovetuleisi")
            }
        });
    }else{
        isLive = false;
    }
}
isLiveOrNot()

//调用java程序进行录制
function startRecord(roomId) {
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
        //还在直播且不是因为主动终止，说明是因为异常退出的，要继续录制
        if(isLive && !earlyTerminated){
            startRecord(roomId)
        }
    })
}

const danmuClient = new huya_danmu("lovetuleisi")
//初始化弹幕模块，用来监听是否开播和下播
danmuClient.on('message', msg => {
    switch (msg.type) {
        case 'beginLive':
            //开始直播
            console.log(JSON.stringify(msg))
            output = "";
            if (!isLive) {
                isLive = true;
                exec("jps", (error, stdout, stderr) => {
                    if (error) {
                        console.log(`error: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.log(`stderr: ${stderr}`);
                        return;
                    }
                    if((/^.+\n$/.test(stdout))){
                        startRecord("lovetuleisi")
                    }
                });
            }
            break
        case 'endLive':
            //结束直播
            console.log(JSON.stringify(msg))
            isLive = false;
            break;
    }
})
danmuClient.on('connect', () => {
    console.log(`已连接huya lovetuleisi房间弹幕~`);
})

danmuClient.on('error', e => {
    console.log(e)
})

danmuClient.on('close', () => {
    console.log('开始断线重连')
    danmuClient.start()
})

danmuClient.start()

app.get("/start", function (req, res) {
    if (proc != null) {
        res.send("Already started");
        return;
    }
    output = ""
    earlyTerminated = false
    let roomId = req.query.roomId;
    startRecord(roomId == null || roomId == undefined ? "lovetuleisi" : roomId)

    res.send("OK,pid is " + proc.pid)
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

var port = 8081
var server = app.listen(port)
console.log('Server listened on: ' + port)
