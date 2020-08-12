const huya_danmu = require('../huya-danmu/index')
const { exec } = require("child_process")
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
                logger.info("启动python脚本下载视频文件")
                exec("python main.py", { cwd: "C:\\Users\\woxia\\PycharmProjects\\download_video" }, (error, stdout, stderr) => {
                    if (error) {
                        logger.error(`error: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        //todo 无效！
                        logger.info(`stderr: ${iconv.decode(stderr,'gbk')}`);
                        return;
                    }
                    if (stdout) {
                        //todo 无效！
                        logger.info(`stdout: ${iconv.decode(stdout,'gbk')}`);
                        return;
                    }
                })
            }, 1000 * 60 * 15)
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