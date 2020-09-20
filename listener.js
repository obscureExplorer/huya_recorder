const huya_danmu = require('../huya-danmu/index')
const { exec, spawn, spawnSync } = require("child_process")
var log4js = require("log4js");
var logger = log4js.getLogger();
logger.level = "info";

var iconv = require('iconv-lite');

let roomId = 'lovetuleisi'
const danmuClient = new huya_danmu(roomId)
//初始化弹幕模块，用来监听是否开播和下播
let timeoutId = null;
let isLive;
danmuClient.on('message', msg => {
    switch (msg.type) {
        // case 'online':
        //     //用来检测是否真的连接到上弹幕服务器
        //     console.log(`[当前人气]:${msg.count}`)
        //     break
        case 'beginLive':
            logger.info("收到上播消息：", JSON.stringify(msg))
            //开始直播
            if (!isLive) {
                isLive = true;
            }
            if (timeoutId != null) {
                clearTimeout(timeoutId);
            }
            break
        case 'endLive':
            //结束直播
            logger.info("收到下播消息：", JSON.stringify(msg))
            isLive = false;
            timeoutId = setTimeout(function () {
                logger.info("开始下载视频文件")
                var proc = spawn("wsl", ["noglob", "rsync", "-av", "--partial"  ,"ubuntu@193.112.25.159:/home/ubuntu/download/*", "/mnt/c/Users/woxia/Documents"]);
                proc.stdout.on("data", data => {
                    logger.info(`stout: ${iconv.decode(data,'utf-8')}`);
                })

                proc.stderr.on("data", data => {
                    logger.info(`stderr: ${iconv.decode(data,'utf-8')}`);
                })

                proc.on('error', (error) => {
                    logger.error(`error: ${iconv.decode(error.message,'utf-8')}`)
                })

                proc.on("exit", () => {
                    logger.info("rsync退出。开始转换视频文件")
                    //转换视频
                    result = spawnSync("python", ["C:\\Users\\woxia\\PycharmProjects\\convert_video\\convert_video.py", "C:\\Users\\woxia\\documents"])
                    logger.info(`stderr: ${iconv.decode(result.stderr,'gbk')}`);
                    logger.info(`stdout: ${iconv.decode(result.stdout,'gbk')}`);

                    logger.info("开始上传到b站")
                    //上传到b站
                    result = spawnSync("python", ["C:\\Users\\woxia\\PycharmProjects\\upload_to_bilibili\\upload_to_bilibili.py"])
                    logger.info(`stderr: ${iconv.decode(result.stderr,'gbk')}`);
                    logger.info(`stdout: ${iconv.decode(result.stdout,'gbk')}`);
                    logger.info("上传完毕")

                })
            }, 1000 * 60 * 10)
            break;
    }
})
danmuClient.on('connect', () => {
    logger.info(`已连接huya ${roomId}房间弹幕~`);
})

danmuClient.on('error', e => {
    logger.error(e)
})

danmuClient.on('close', () => {
    logger.info('开始断线重连')
    danmuClient.start()
})

danmuClient.start()