/* 
 * @desc : 接口库
 * @createtime : 2016-05-10 11:04
 * @updatetime : 2016-07-04 09:48 
 * @author : chen
 */
var http = require('http');
var request = require('request');
var querystring = require("querystring");
var express = require('express'); //导入express
var bodyParser = require('body-parser'); //导入body-parser
var url = require('url');
var util = require('util');
var fs = require('fs');
var path = require("path");
var targz = require('tar.gz');
/*日志*/
var log4js = require('log4js');

var redis = require("redis");//redis发布订阅
var request = require('request'); //xiaoliu add 2017-4-6

/*log4js.configure({
    "appenders": [
        // 下面一行应该是用于跟express配合输出web请求url日志的  
        { "type": "console", "category": "console" },
        // 定义一个日志记录器  
        {
            "type": "file",
            "filename": "logs/log.log",
            "maxLogSize": 10485760,
            "numBackups": 3
        }
    ],
    "replaceConsole": true
});*/

// 加载配置文件  
var objConfig = JSON.parse(fs.readFileSync("log4js.json", "utf8"));  
  
// 检查配置文件所需的目录是否存在，不存在时创建  
if(objConfig.appenders){  
    var baseDir = objConfig["customBaseDir"];  
    var defaultAtt = objConfig["customDefaultAtt"];  
  
    for(var i= 0, j=objConfig.appenders.length; i<j; i++){  
        var item = objConfig.appenders[i];  
        if(item["type"] == "console")  
            continue;  
  
        if(defaultAtt != null){  
            for(var att in defaultAtt){  
                if(item[att] == null)  
                    item[att] = defaultAtt[att];  
            }  
        }  
        if(baseDir != null){  
            if(item["filename"] == null)  
                item["filename"] = baseDir;  
            else  
                item["filename"] = baseDir + item["filename"];  
        }  
        var fileName = item["filename"];  
        if(fileName == null)  
            continue;  
        var pattern = item["pattern"];  
        if(pattern != null){  
            fileName += pattern;  
        }  
        var category = item["category"];  
        if(!isAbsoluteDir(fileName))//path.isAbsolute(fileName))  
            throw new Error("配置节" + category + "的路径不是绝对路径:" + fileName);  
        //console.log("fileName="+fileName)
        var dir = path.dirname(fileName);  
        checkAndCreateDir(dir);  
    }  
}  
  

// 目录创建完毕，才加载配置，不然会出异常  
log4js.configure(objConfig);  
var logInfo = log4js.getLogger('logInfo');  
//logInfo.info("测试日志信息");  
//var log = log4js.getLogger("startup");


var mongodbUtil = require('./util_mongodb.js'); //导入util_mongodb.js
var util_common = require('./util_common.js'); //导入util_common.js
var config_file_url = require('./file_url.js');//file_url.js 配置文件路径
var singleLogin = require('./singleLogin.js');//singleLogin.js 导入singleLogin.js
var getIp = require('./get_ip.js');//内网ip
var app = express();
var server = require('http').createServer(app);
var PORT = 7004;

var DB_HOST = "127.0.0.1"; //数据库host
var DB_PORT = 27017; //数据库端口
var DB_NAME = "chinaMobile20170327"; //数据库名
var DB_CONN_STR = "mongodb://" + DB_HOST + ":" + DB_PORT + "/" + DB_NAME;

app.use(bodyParser.json({ limit: '1mb' })); //这里指定参数使用 json 格式
app.use(bodyParser.urlencoded({
    extended: true
}));
//设置跨域访问
app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1')
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});

/* 
 * @desc : 客户端登记(POST)
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.post('/user/clientregister', function(req, res) {
    //测试数据
    var testJson = {
        "name": "", //名称
        "alias": "", //别名
        "idtag": "h5", //客户端类型
        "groupid": "", //网关分组
        "area": "", //登记区域
        "ip": "", //登记IP
        "wanmac": "", //无线MAC
        "lanmac": "", //有线MAC
        "working": "" //工作态
    };

    //获取post数据
    var body = req.body;

    var name = randomWord(false, 8); //randomWord(false,32);
    var alias = body["alias"];
    var idtag = body["idtag"];
    //var groupid = body["groupid"];
    //var areaid = body["areaid"];
    //var ip = body["ip"];
    var wanmac = body["wanmac"];
    //var lanmac = body["lanmac"];
    var working = body["working"];
    var returnInfo; //返回信息
    //获取nodejs配置文件（组、区域、场景等数据）
    var nodejs_conf = get_go3c_nodejs_conf();
    var groupid = nodejs_conf["GROUPID"];
    var scene = nodejs_conf["SCENE"];
    var areaid = nodejs_conf["AREA"];
    var position = nodejs_conf["POSITION"];
    var ip = nodejs_conf["IP"];
    //var wanmac = nodejs_conf["WANMAC"];
    var lanmac = nodejs_conf["LANMAC"];
    var spid = nodejs_conf["SPID"];
    var uuid = nodejs_conf["UUID"];
    //设置默认值
    if (name == null || name.length == 0) {
        name = "";
    }
    if (alias == null || alias.length == 0) {
        alias = "";
    }
    if (groupid == null || groupid.length == 0) {
        groupid = "";
    }
    if (areaid == null || areaid.length == 0) {
        areaid = "";
    }
    if (ip == null || ip.length == 0) {
        ip = "";
    }
    if (wanmac == null || wanmac.length == 0) {
        wanmac = "";
    }
    if (lanmac == null || lanmac.length == 0) {
        lanmac = "";
    }
    if (working == null || working.length == 0) {
        working = "";
    }
    if (position == null || position.length == 0) {
        position = "";
    }
    if (scene == null || scene.length == 0) {
        scene = "";
    }
    //执行核心逻辑
    if (idtag != null && idtag.length > 0) { //如果有些参数是必填参数，则需要做判断
        //根据有线MAC和无线MAC来判断是否存在该客户端,如果存在则直接返回UUID，如果不存在则生成UUID并插入数据库
        mongodbUtil.commonSelect(DB_CONN_STR, "t_app_register", { "f_wanmac": wanmac, "f_lanmac": lanmac }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则直接返回UUID
                    returnInfo = { "state": "0", "message": "Success", "UUID": result[0]["f_id"] };
                    //res.send(returnInfo);
                    var id = randomWord(false, 32);
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var newData = {
                        "name": name,
                        "alias": alias,
                        "f_idtags": idtag,
                        "f_working": working,
                        "f_areaid": areaid,
                        "f_id": id,
                        "f_wanmac": wanmac,
                        "f_lanmac": lanmac,
                        "f_wanip": ip,
                        "f_groupid": groupid,
                        "createtime": time,
                        "updatetime": "",
                        "listorder": 0
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_app_register", newData, function(state, error, result) {
                        if (state == "0") {
                            returnInfo = { "state": "0", "message": "Success", "UUID": id, "spid": spid, "gatewayGroupLevel": [{ "name": groupid, "number": uuid }], "gateway": { "number": uuid, "position": position, "sceneid": scene, "remarks": "gateway" } };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则生成UUID并插入数据库
                    var id = randomWord(false, 32);
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var newData = {
                        "name": name,
                        "alias": alias,
                        "f_idtags": idtag,
                        "f_working": working,
                        "f_areaid": areaid,
                        "f_id": id,
                        "f_wanmac": wanmac,
                        "f_lanmac": lanmac,
                        "f_wanip": ip,
                        "f_groupid": groupid,
                        "createtime": time,
                        "updatetime": "",
                        "listorder": 0
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_app_register", newData, function(state, error, result) {
                        if (state == "0") {
                            returnInfo = { "state": "0", "message": "Success", "UUID": id, "spid": spid, "gatewayGroupLevel": [{ "name": groupid, "number": uuid }], "gateway": { "number": uuid, "position": position, "sceneid": scene, "remarks": "gateway" } };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "params is undefined" };
        res.send(returnInfo);
    }
});




app.get('/user/clientregister', function(req, res) {
    //测试数据
    var testJson = {
        "name": "", //名称
        "alias": "", //别名
        "idtag": "h5", //客户端类型
        "groupid": "", //网关分组
        "area": "", //登记区域
        "ip": "", //登记IP
        "wanmac": "", //无线MAC
        "lanmac": "", //有线MAC
        "working": "" //工作态
    };

    //获取post数据
    var body = req.query;

    var name = randomWord(false, 8); //randomWord(false,32);
    var alias = body["alias"];
    var idtag = body["idtag"];
    //var groupid = body["groupid"];
    //var areaid = body["areaid"];
    //var ip = body["ip"];
    var wanmac = body["wanmac"];
    //var lanmac = body["lanmac"];
    var working = body["working"];
    var returnInfo; //返回信息
    //获取nodejs配置文件（组、区域、场景等数据）
    var nodejs_conf = get_go3c_nodejs_conf();
    var groupid = nodejs_conf["GROUPID"];
    var scene = nodejs_conf["SCENE"];
    var areaid = nodejs_conf["AREA"];
    var position = nodejs_conf["POSITION"];
    var ip = nodejs_conf["IP"];
    //var wanmac = nodejs_conf["WANMAC"];
    var lanmac = nodejs_conf["LANMAC"];
    var spid = nodejs_conf["SPID"];
    var uuid = nodejs_conf["UUID"];
    //设置默认值
    if (name == null || name.length == 0) {
        name = "";
    }
    if (alias == null || alias.length == 0) {
        alias = "";
    }
    if (groupid == null || groupid.length == 0) {
        groupid = "";
    }
    if (areaid == null || areaid.length == 0) {
        areaid = "";
    }
    if (ip == null || ip.length == 0) {
        ip = "";
    }
    if (wanmac == null || wanmac.length == 0) {
        wanmac = "";
    }
    if (lanmac == null || lanmac.length == 0) {
        lanmac = "";
    }
    if (working == null || working.length == 0) {
        working = "";
    }
    if (position == null || position.length == 0) {
        position = "";
    }
    if (scene == null || scene.length == 0) {
        scene = "";
    }
    //执行核心逻辑
    if (idtag != null && idtag.length > 0) { //如果有些参数是必填参数，则需要做判断
        //根据有线MAC和无线MAC来判断是否存在该客户端,如果存在则直接返回UUID，如果不存在则生成UUID并插入数据库
        mongodbUtil.commonSelect(DB_CONN_STR, "t_app_register", { "f_wanmac": wanmac, "f_lanmac": lanmac }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则直接返回UUID
                    returnInfo = { "state": "0", "message": "Success", "UUID": result[0]["f_id"] };
                    //res.send(returnInfo);
                    var id = randomWord(false, 32);
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var newData = {
                        "name": name,
                        "alias": alias,
                        "f_idtags": idtag,
                        "f_working": working,
                        "f_areaid": areaid,
                        "f_id": id,
                        "f_wanmac": wanmac,
                        "f_lanmac": lanmac,
                        "f_wanip": ip,
                        "f_groupid": groupid,
                        "createtime": time,
                        "updatetime": "",
                        "listorder": 0
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_app_register", newData, function(state, error, result) {
                        if (state == "0") {
                            returnInfo = { "state": "0", "message": "Success", "UUID": id, "spid": spid, "gatewayGroupLevel": [{ "name": groupid, "number": uuid }], "gateway": { "number": uuid, "position": position, "sceneid": scene, "remarks": "gateway" } };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则生成UUID并插入数据库
                    var id = randomWord(false, 32);
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var newData = {
                        "name": name,
                        "alias": alias,
                        "f_idtags": idtag,
                        "f_working": working,
                        "f_areaid": areaid,
                        "f_id": id,
                        "f_wanmac": wanmac,
                        "f_lanmac": lanmac,
                        "f_wanip": ip,
                        "f_groupid": groupid,
                        "createtime": time,
                        "updatetime": "",
                        "listorder": 0
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_app_register", newData, function(state, error, result) {
                        if (state == "0") {
                            returnInfo = { "state": "0", "message": "Success", "UUID": id, "spid": spid, "gatewayGroupLevel": [{ "name": groupid, "number": uuid }], "gateway": { "number": uuid, "position": position, "sceneid": scene, "remarks": "gateway" } };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "params is undefined" };
        res.send(returnInfo);
    }
})


/* 
 * @desc : 刮刮卡-登录(POST)
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.post('/user/scratchcard/login', function(req, res) {
    //获取post数据
    var body = req.body;
    var cardNumber = body["cardNumber"];//卡号
    var password = body["password"];//密码
    var phoneNumber = body["phoneNumber"];//手机号
    var gatewayGroup = body["gatewayGroup"];//网关组
    var gateway = body["gateway"];//网关
    var returnInfo = "";//返回信息
    if (password != null && password.length > 0) {
        //console.log(password);
        //查询刮刮卡管理表，表中有用户输入的密码则可进去鉴权，否则返回错误信息
        //登录处理
        //singleLogin.guaguakaLogin(res,cardNumber,password,phoneNumber,gatewayGroup,gateway);
        singleLogin.guaguakaLogin(res,cardNumber,password,phoneNumber,gatewayGroup,gateway)
    } else {
        returnInfo = { "state": "-3", "message": "密码不能为空" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 刮刮卡-登出
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/scratchcard/logout/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var id = req["query"]["id"];
    var returnInfo = "";
    //console.log(id);
    if (id != null && id.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_card_guagua_status", { "f_cardNumber": id }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则返回卡号
                    var _id = result[0]["_id"];
                    var updateData = result[0];
                    updateData["f_token"] = "";
                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_card_guagua_status", { "_id": _id }, updateData, function(state2, error2, result2) {
                        if (state2 == "0") {
                            returnInfo = { "state": "0", "message": "success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error2 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则返回不存在
                    returnInfo = { "state": "-1", "message": "id is not exist" };
                    res.send(returnInfo);
                }
            } else {
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "id is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 用户登录(POST)
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.post('/user/account/login', function(req, res) {
    //测试数据
    var testJson = {
        "name": "", //用户名
        "password": "", //密码
    };

    //获取post数据
    var body = req.body;

    var name = body["name"];
    var password = body["password"];

    if (name != null && name.length > 0 && password != null && password.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user", { "name": name }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则返回用户编号
                    var f_id = result[0]["f_id"];

                    mongodbUtil.commonSelect(DB_CONN_STR, "t_user_token", { "f_id": f_id, "f_password": password }, function(state2, error2, result2) {
                        if (state2 == "0") { //数据库操作正确执行
                            if (result2 != null && result2.length > 0) { //如果存在则更新
                                var _id = result2[0]["_id"];
                                var id = result2[0]["f_id"];
                                var token = randomWord(false, 32);

                                var updateData = result2[0];
                                updateData["f_token"] = token;

                                mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_token", { "_id": _id }, updateData, function(state3, error3, result3) {
                                    if (state3 == "0") {
                                        returnInfo = { "state": "0", "message": "success", "id": id, "token": token };
                                        res.send(returnInfo);
                                    } else {
                                        returnInfo = { "state": "-1", "message": error3 };
                                        res.send(returnInfo);
                                    }
                                });
                            } else {
                                returnInfo = { "state": "-1", "message": "user is not exist" };
                                res.send(returnInfo);
                            }
                        } else {
                            returnInfo = { "state": "-1", "message": error2 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则返回不存在
                    returnInfo = { "state": "-1", "message": "user is not exist" };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "name or password is undefined" };
        res.send(returnInfo);
    }
});


app.get('/user/account/login', function(req, res) {
    //测试数据
    var testJson = {
        "name": "", //用户名
        "password": "", //密码
    };

    //获取post数据
    var body = req.query;

    var name = body["name"];
    var password = body["password"];

    if (name != null && name.length > 0 && password != null && password.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user", { "name": name }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则返回用户编号
                    var f_id = result[0]["f_id"];

                    mongodbUtil.commonSelect(DB_CONN_STR, "t_user_token", { "f_id": f_id, "f_password": password }, function(state2, error2, result2) {
                        if (state2 == "0") { //数据库操作正确执行
                            if (result2 != null && result2.length > 0) { //如果存在则更新
                                var _id = result2[0]["_id"];
                                var id = result2[0]["f_id"];
                                var token = randomWord(false, 32);

                                var updateData = result2[0];
                                updateData["f_token"] = token;

                                mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_token", { "_id": _id }, updateData, function(state3, error3, result3) {
                                    if (state3 == "0") {
                                        returnInfo = { "state": "0", "message": "success", "id": id, "token": token };
                                        res.send(returnInfo);
                                    } else {
                                        returnInfo = { "state": "-1", "message": error3 };
                                        res.send(returnInfo);
                                    }
                                });
                            } else {
                                returnInfo = { "state": "-1", "message": "user is not exist" };
                                res.send(returnInfo);
                            }
                        } else {
                            returnInfo = { "state": "-1", "message": error2 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则返回不存在
                    returnInfo = { "state": "-1", "message": "user is not exist" };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "name or password is undefined" };
        res.send(returnInfo);
    }
})



/* 
 * @desc : 用户登出
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/scratchcard/logout/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var id = req["query"]["id"];
    var returnInfo;

    if (id != null && id.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_token", { "f_id": id }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则返回卡号
                    var _id = result[0]["_id"];

                    var updateData = result[0];
                    updateData["f_token"] = "";

                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_token", { "_id": _id }, updateData, function(state2, error2, result2) {
                        if (state2 == "0") {
                            if (result2 != null && result2.length > 0) { //如果存在则更新
                                var _id = result2[0]["f_vid"];
                                mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_token", { "_id": _id }, updateData, function(state2, error2, result2) {
                                    if (state2 == "0") {
                                        if (result2 != null && result2.length > 0) { //如果存在则更新
                                            var _id = result2[0]["f_vid"];
                                        } else {
                                            returnInfo = { "state": "-1", "message": "user is not exist" };
                                            res.send(returnInfo);
                                        }
                                    } else {
                                        returnInfo = { "state": "-1", "message": error2 };
                                        res.send(returnInfo);
                                    }
                                });
                            } else {
                                returnInfo = { "state": "-1", "message": "user is not exist" };
                                res.send(returnInfo);
                            }
                        } else {
                            returnInfo = { "state": "-1", "message": error2 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则返回不存在
                    returnInfo = { "state": "-1", "message": "id is not exist" };
                    res.send(returnInfo);
                }
            } else {
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "id is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 点播收藏-添加收藏
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/favorite/vod/add/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"];
    var vid = req["query"]["vid"];
    var videoName = req["query"]["videoName"];
    var videoImgUrl = req["query"]["videoImgUrl"];
    var termid = req["query"]["termid"];
    var uuid = req["query"]["uuid"];
    var openid = req["query"]["openid"];
    var returnInfo;
    //console.log(userID);
    //console.log(vid);
    var str=".";
    vid=vid.split(str)[0]; //视频id去掉分集
    
    if (userID != null || userID.length > 0 && vid != null || vid.length > 0 && termid != null || termid.length > 0) {
        time = getCurTime("yyyy-MM-dd hh:mm:ss");
        var newData = {
            "f_vid": vid,
            "f_id": userID,
            "f_datetime": time,
            "f_videoName": videoName,
            "f_videoImgUrl": videoImgUrl,
            "f_uuid": uuid,
            "createtime": time,
            "openid": openid,
            "termid":termid, //xiauliu add 2017-4-7
            //"playtime":playtime, //xiaoliu add 2017-5-5
            "f_cancel_time": "",
            "listorder": "",
        }
        mongodbUtil.commonInsert(DB_CONN_STR, "t_user_favorite_video_log", newData, function(state2, error2, result2) {
            if (state2 == "0") {
                //记录点播收藏历史日志
                //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
                mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_video", { "f_id": userID, "f_vid": vid }, function(state, error, result) {
                    if (state == "0") { //数据库操作正确执行
                        //console.log(result+"=============");
                        if (result != null && result.length > 0) { //如果存在则跟新信息的时间
                            var _id = result[0]["_id"];
                            var updateData = result[0];
                            updateData["f_datetime"] = time;
                            //updateData["createtime"] = time;
                            //updateData["playtime"] = playtime;
                            //updateData["f_epsode"] = videoNumber;
                            mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_history_video", { "_id": _id }, updateData, function(state3, error3, result3) {
                                if (state3 == "0") {
                                    returnInfo = { "state": "0", "message": "update success" };
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error3 };
                                    res.send(returnInfo);
                                }
                            });
                        } else { //如果不存在则插入数据库
                            mongodbUtil.commonInsert(DB_CONN_STR, "t_user_favorite_video", newData, function(state1, error1, result1) {
                                if (state1 == "0") {
                                    returnInfo = { "state": "0", "message": "collection video Success" };
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error1 };
                                    res.send(returnInfo);
                                }
                            });
                        }
                    } else { //数据库操作出现错误
                        returnInfo = { "state": "-1", "message": error };
                        res.send(returnInfo);
                    }
                });
            } else {
                returnInfo = { "state": "-1", "message": error1 };
                res.send(returnInfo);
            }
        });
    } else {
        //console.log(111);
        returnInfo = { "state": "-1", "message": "userID or vid or termid is undefined" };
        res.send(returnInfo);
    }
});
/* 
 * @desc : 点播收藏-删除收藏
 * @params : req-请求 res-响应
 * @return : 暂无
 */

app.get('/user/favorite/vod/delete/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"];
    var vid = req["query"]["vid"];
    var termid = req["query"]["termid"];
    var returnInfo;
    var i = 0;

    if (userID != null || userID.length > 0 && vid != null || vid.length > 0 && termid != null || termid.length > 0) {
        //多个vid值，存在数组中
        if (vid.indexOf(",") != -1) {
            var vodArray = vid.split(",");
            vodArray.forEach(function(v) {
	            var str=".";
                 v=v.split(str)[0]; //视频id去掉分集
                mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_video", { "f_id": userID, "f_vid": v }, function(state, error, result) {
                    //console.log("===========" + v);
                    if (state == "0") { //数据库操作正确执行
                        logInfo.info(result); 
                        //console.log(result);
                        if (result != null && result.length > 0) { //如果存在则直接返回error信息
                            mongodbUtil.commonRemove(DB_CONN_STR, "t_user_favorite_video", { "f_id": userID, "f_vid": v }, function(state1, error1, result1) {
                                if (state1 == "0") {
                                    returnInfo = { "state": "0", "message": "remove Success" };
                                    i = i + 1;
                                    //跟新日志记录里的取消时间
                                    var _id = result[0]["_id"]; //获取唯一id
                                    //console.log("==========="+_id);
                                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                                    var updateData = result[0];
                                    updateData["f_cancel_time"] = time;
                                    updateData["createtime"] = time;
                                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_favorite_video_log", { "_id": _id }, updateData, function(state4, error4, result4) {});
                                    if (i == vodArray.length) {
                                        res.send(returnInfo);
                                    }
                                }
                            });
                        } else {
                            returnInfo = { "state": "-1", "message": "result is []" };
                            i = i + 1;
                            if (i == vodArray.length) {
                                res.send(returnInfo);
                            }
                            //res.send(returnInfo);
                        }
                    } else { //数据库操作出现错误
                        returnInfo = { "state": "-1", "message": error };
                        i = i + 1;
                        if (i == vodArray.length) {
                            res.send(returnInfo);
                        }
                    }
                });
            });
        } else {
	        var str=".";
             vid=vid.split(str)[0]; //视频id去掉分集
            //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
            mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_video", { "f_id": userID, "f_vid": vid }, function(state, error, result) {
                if (state == "0") { //数据库操作正确执行
                    if (result != null && result.length > 0) { //如果存在则直接返回error信息
                        mongodbUtil.commonRemove(DB_CONN_STR, "t_user_favorite_video", { "f_id": userID, "f_vid": vid }, function(state1, error1, result1) {
                            if (state1 == "0") {
                                //跟新日志记录里的取消时间
                                var _id = result[0]["_id"]; //获取唯一id
                                //console.log(result[0]);
                                var updateData = result[0];
                                var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                                updateData["f_cancel_time"] = time;
                                updateData["createtime"] = time;
                                mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_favorite_video_log", { "_id": _id }, updateData, function(state4, error4, result4) {});
                                returnInfo = { "state": "0", "message": "remove Success" };
                                res.send(returnInfo);
                            } else {
                                returnInfo = { "state": "-1", "message": error1 };
                                res.send(returnInfo);
                            }
                        });
                    } else {
                        returnInfo = { "state": "-1", "message": "userID or vid is undefined" };
                        res.send(returnInfo);
                    }
                } else { //数据库操作出现错误
                    returnInfo = { "state": "-1", "message": error };
                    res.send(returnInfo);
                }
            });
        }
    } else {
        returnInfo = { "state": "-1", "message": "userID or vid  is undefined" };
        res.send(returnInfo);
    }
});
/* 
 * @desc : 点播收藏-清空收藏
 * @params : req-请求 res-响应
 * @return : 暂无
 */

app.get('/user/favorite/vod/clear/*', function(req, res) {
    var userID = req["query"]["userID"];
    var termid = req["query"]["termid"];
    var returnInfo;

    if (userID != null || userID.length > 0 && termid != null || termid.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_video", { "f_id": userID }, function(state, error, result) {
            if (result != null && result.length > 0) {
                result.forEach(function(updateData) {
                    mongodbUtil.commonRemove(DB_CONN_STR, "t_user_favorite_video", { "f_id": userID }, function(state1, error1, result1) {});
                    //跟新日志记录里的取消时间
                    var f_vid = updateData["f_vid"];
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    updateData["f_cancel_time"] = time;
                    updateData["createtime"] = time;
                    //console.log(updateData);
                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_favorite_video_log", { "f_id": userID, "f_vid": f_vid }, updateData, function(state4, error4, result4) {});
                });
                returnInfo = { "state": "0", "message": "remove Success" };
                res.send(returnInfo);
            } else {
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 点播收藏-获取收藏
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/favorite/vod/get/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"];
    var timeperiod = req["query"]["timeperiod"];
    var termid = req["query"]["termid"];
    var returnInfo;
     //console.log(userID+":"+termid);
    if ((userID != null && userID.length > 0) && (termid != null && termid.length > 0)) {
        //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_video", { "f_id": userID }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                console.log("length:"+result.length);
                if (result != null && result.length > 0) {
                  var data=new Array();
                  var endflag=0;
	              var tmp='';
                  result.map((issue)=>{
	                    var f_vid=issue.f_vid;
						var f_datetime=issue.f_datetime||'';
						var createtime=issue.createtime || '';						
						var data1={"f_datetime":f_datetime,"createtime":createtime,"f_vid":f_vid};
						data.push(data1);
						tmp=tmp+f_vid+',';
						endflag=endflag+1;
						if(endflag==result.length){
							tmp=tmp.slice(0,tmp.length-1);
							var url="http://www.go3c.tv:8030/backend/mobileott/api/php/php_video_list.php?vids="+tmp;							
								request({
								    url: url,
								    method: "GET",
								    json: true,
								    headers: {
								    "content-type": "application/json",
								    }}, function(error, response, body) {
								    if (!error && response.statusCode == 200) {
									    var fflag=0;
									    data.map((issue1)=>{
											var vvid=issue1.f_vid;
											var pptime=issue1.f_datetime;
											var vnum=issue1.createtime;
											//vvid=vvid+vnum;
											response.body.map((issue2)=>{
												
												if(vvid==issue2.ID){
													fflag=fflag+1;
													issue2.f_datetime=pptime||'';	
													issue2.createtime=vnum ||'';
													if(fflag==data.length){														
														returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body};
				                    					res.send(returnInfo);								
													}																				
												}																	
											})							
										    
									    })
									    
									    //returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body,"playtime":data};
                    					//res.send(returnInfo);
									    //res.send(response.body)
								    }else{
									    returnInfo = { "state": "-1", "message": "内部获取数据出错！"};
                    					res.send(returnInfo);
								    }
								});													
						  }																				    							
                          })		
                   
                } else {
                    returnInfo = { "state": "-1", "message": "userID无记录！" };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID or vid  is undefined" };
        res.send(returnInfo);
    }
});


/* 
 * @desc : 直播收藏-添加收藏
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/favorite/livetv/add/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    var userID = req["query"]["userID"];
    var channelID = req["query"]["channelID"];
    var channelName = req["query"]["channelName"];
    var channeImgUrl = req["query"]["channeImgUrl"];
    var termid = req["query"]["termid"];
    var uuid = req["query"]["uuid"];
    var openid = req["query"]["openid"];
    var cpId=req["query"]["cpId"]; //频道类型 xiaoliu add 2017-5-31
    var returnInfo;

    if (userID != null || userID.length > 0 && channelID != null || channelID.length > 0 && termid != null || termid.length > 0) {
        time = getCurTime("yyyy-MM-dd hh:mm:ss");
        var newData = {
            "f_chanid": channelID,
            "f_id": userID,
            "f_datetime": time,
            "f_channelName": channelName,
            "f_channeImgUrl": channeImgUrl,
            "f_uuid": uuid,
            "openid": openid,
            "createtime": time,
            "termid":termid, //huwugang add 2017-4-8
            "cpId":cpId, //频道类型 xiaoliu add 2017-5-31
            "f_cancel_time": "",
            "f_sort": "",
            "listorder": "",
        };
        mongodbUtil.commonInsert(DB_CONN_STR, "t_user_favorite_livetv_log", newData, function(state2, error2, result2) {
            if (state2 == "0") {
                //记录直播收藏历史日志
                //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
                mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_livetv", { "openid": openid, "f_chanid": channelID,"termid":termid }, function(state, error, result) {
                    if (state == "0") { //数据库操作正确执行
                        if (result != null && result.length > 0) { //如果存在则直接返回重复收藏信息
                            returnInfo = { "state": "1", "message": "Repeated collection" };
                            //console.log("Repeated collection");
                            res.send(returnInfo);
                        } else { //如果不存在则插入数据库

                            mongodbUtil.commonInsert(DB_CONN_STR, "t_user_favorite_livetv", newData, function(state1, error1, result1) {
                                if (state1 == "0") {
                                    returnInfo = { "state": "0", "message": "collection Success" };
                                    //console.log("collection Success");
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error1 };
                                    res.send(returnInfo);
                                }
                            });
                        }
                    } else { //数据库操作出现错误
                        returnInfo = { "state": "-1", "message": error };
                        res.send(returnInfo);
                    }
                });
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error2 };
                res.send(returnInfo);
            }
        });
    } else {
        //console.log(11111);
        returnInfo = { "state": "-1", "message": "userID or channelID or termid is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 直播收藏-删除收藏
 * @params : req-请求 res-响应
 * @return : 暂无
 */
//定义删除vod   userID是用户id，channelID是直播频道id，termid是终端类型

app.get('/user/favorite/livetv/delete/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    var userID = req["query"]["userID"];
    var channelID = req["query"]["channelID"];
    var termid = req["query"]["termid"];
    var returnInfo;
    var i = 0;
    
    //console.log(userID);
    //console.log(channelID);
    if ((userID != null && userID.length > 0) && (channelID != null && channelID.length > 0)) {
        //多个channelID值，存在数组中
        if (channelID.indexOf(",") != -1) {
            // console.log(1111);
            var channelArray = channelID.split(",");
            channelArray.forEach(function(v) {
                mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_livetv", { "f_id": userID, "f_chanid": v,"termid":termid }, function(state, error, result) {
                    //console.log("==========="+v);
                    console.log("删除收藏userID="+userID+"::"+termid+"vvvv"+v);
                console.log("删除收藏查询结果"+result);
                    if (state == "0") { //数据库操作正确执行
                        //console.log(result);
                        if (result != null && result.length > 0) { //如果存在则直接返回error信息
                            mongodbUtil.commonRemove(DB_CONN_STR, "t_user_favorite_livetv", { "f_id": userID, "f_chanid": v,"termid":termid }, function(state1, error1, result1) {
                                if (state1 == "0") {
                                    returnInfo = { "state": "0", "message": "remove Success" };
                                    i = i + 1;
                                    //跟新日志记录里的取消时间
                                    var _id = result[0]["_id"]; //获取唯一id
                                    //console.log("==========="+_id);
                                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                                    var updateData = result[0];
                                    updateData["f_cancel_time"] = time;
                                    updateData["createtime"] = time;
                                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_favorite_livetv_log", { "_id": _id }, updateData, function(state4, error4, result4) {});
                                    if (i == channelArray.length) {
                                        res.send(returnInfo);
                                    }
                                }
                            });
                        } else {
                            returnInfo = { "state": "-1", "message": "result is []" };
                            i = i + 1;
                            if (i == channelArray.length) {
                                res.send(returnInfo);
                            }
                            //res.send(returnInfo);
                        }
                    } else { //数据库操作出现错误
                        returnInfo = { "state": "-1", "message": error };
                        i = i + 1;
                        if (i == channelArray.length) {
                            res.send(returnInfo);
                        }
                    }
                });
            });
        } else {
            //console.log(2222);
            //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
            mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_livetv", { "f_id": userID, "f_chanid": channelID,"termid":termid }, function(state, error, result) {
                if (state == "0") { //数据库操作正确执行
                    //console.log(result[0]["f_id"]+"========"+result[0]["f_chanid"]);
                    //userID = result[0]["f_id"];
                    //channelID = result[0]["f_chanid"];
                     console.log("删除收藏1userID="+userID+"::"+termid+"vvvv"+channelID);
                console.log("删除收藏1查询结果"+result);
                    if (result != null && result.length > 0) { //如果存在则直接返回error信息
                    userID = result[0]["f_id"];
                    channelID = result[0]["f_chanid"];
                        mongodbUtil.commonRemove(DB_CONN_STR, "t_user_favorite_livetv", { "f_id": userID, "f_chanid": channelID,"termid":termid }, function(state1, error1, result1) {
                            if (state1 == "0") {
                                //跟新日志记录里的取消时间
                                var _id = result[0]["_id"]; //获取唯一id
                                //console.log("==========="+_id);
                                var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                                var updateData = result[0];
                                updateData["f_cancel_time"] = time;
                                updateData["createtime"] = time;
                                mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_favorite_livetv_log", { "_id": _id }, updateData, function(state4, error4, result4) {});
                                returnInfo = { "state": "0", "message": "remove Success", "result1": result1, "result": result };
                                res.send(returnInfo);
                            } else {
                                returnInfo = { "state": "-1", "message": error1 };
                                res.send(returnInfo);
                            }
                        });
                    } else {
                        returnInfo = { "state": "-1", "message": "没有此条记录！" };
                        res.send(returnInfo);
                    }
                } else { //数据库操作出现错误
                    returnInfo = { "state": "-1", "message": error };
                    res.send(returnInfo);
                }
            });
        }
    } else {
        returnInfo = { "state": "-1", "message": "userID or channelID  is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 直播收藏-清空收藏
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/favorite/livetv/clear/*', function(req, res) {
    var userID = req["query"]["userID"];
    var termid = req["query"]["termid"];
    var returnInfo;

    if (userID != null || userID.length > 0 && termid != null || termid.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_livetv", { "f_id": userID,"termid":termid }, function(state, error, result) {
            if (state == "0") {
                if (result != null && result.length > 0) {
                    result.forEach(function(updateData) {
                        mongodbUtil.commonRemove(DB_CONN_STR, "t_user_favorite_livetv", { "f_id": userID,"termid":termid }, function(state1, error1, result1) {});
                        //跟新日志记录里的取消时间
                        var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                        var f_chanid = updateData["f_chanid"];
                        updateData["f_cancel_time"] = time;
                        updateData["createtime"] = time;
                        mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_favorite_livetv_log", { "f_id": userID, "f_chanid": f_chanid }, updateData, function(state4, error4, result4) {});
                    });
                    returnInfo = { "state": "0", "message": "remove Success" };
                    res.send(returnInfo);
                } else {
                    returnInfo = { "state": "-1", "message": error };
                    res.send(returnInfo);
                }
            } else {
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 直播收藏-获取收藏
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/favorite/livetv/get/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"];
    var timeperiod = req["query"]["timeperiod"];
    var termid = req["query"]["termid"];
    var returnInfo;
    //console.log(userID);
    if ((userID != null && userID.length > 0) && (termid != null && termid.length > 0)) {
        //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_favorite_livetv", { "f_id": userID,"termid":termid }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
            console.log("获取收藏userID="+userID+"::"+termid);
                console.log("获取收藏查询结果"+result);
                if (result != null && result.length > 0) {
                    /*$.each(result, function(k, v){
                    	var f_id = v.["f_vid"];
                    	
                    });*/
                    //console.log(result);
                    returnInfo = { "state": "0", "message": "获取成功！", "videolist": result };
                    res.send(returnInfo);
                } else {
                    returnInfo = { "state": "-1", "message": "userID or timeperiod is undefined" };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID or vid  is undefined" };
        res.send(returnInfo);
    }
});


/* 
 * @desc : 直播播放链接鉴权接口转发
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/auth', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    var STREAM_LIVE = req["query"]["STREAM_LIVE"];
    var realURL = req["query"]["realURL"]; //"http://192.168.19.14:2000/vodfiles/amfy/amfy3.mp4";
    var uri = req["query"]["uri"];
    uri = uri.substr(5, uri.length);
    var token = req["query"]["token"];
    var channelID = req["query"]["channelID"];
    var port = req["query"]["port"];
    var playtime = req["query"]["playtime"];
    //var playtime = req["query"]["playtime"];
    /*playtime = 7776000;
    if(token =="" || token == null){
    	var num = randomWord(false,12);
    	token = "usertest_"+num;
    	playtime = 360;
    }*/
    //console.log(token !="" && token != null && uri !="" && uri != null && realURL !="" && realURL != null && channelID != "" && channelID != null);
    if (token != "" && token != null && uri != "" && uri != null && realURL != "" && realURL != null && channelID != "" && channelID != null) {
        var GO3C_URL = STREAM_LIVE + port + "/livetv/play/auth";
        var timestamp = Date.parse(new Date());
        timestamp = timestamp / 1000 + playtime;
        timestamp = timestamp.toString();
        var ts = util_common.base64Encode(timestamp);
        var MD5sum = uri + token + timestamp
        var key = util_common.base64Encode(util_common.MD5sumfunction(MD5sum));
        realURL = util_common.base64Encode(realURL);
        var authURL = GO3C_URL + "?token=" + token + "&key=" + key + "&ts=" + ts + "&url=" + realURL;
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_auth_livetv", { "f_token": token }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则直接返回error信息
                    //returnInfo = {"state":"-1","message":"Repeated collection"};
                    //res.send(returnInfo);
                    mongodbUtil.commonRemove(DB_CONN_STR, "t_user_auth_livetv", { "f_token": token }, function(state1, error1, result1) {
                        if (state1 == "0") {
                            var newData = { "f_token": token, "f_chanid": channelID, "f_key": key, "f_ts": ts, "f_uri": uri, "f_busy": "" };
                            mongodbUtil.commonInsert(DB_CONN_STR, "t_user_auth_livetv", newData, function(state, error, result) {
                                //console.log("delete insert");
                                if (state == "0") {
                                    returnInfo = { "state": "0", "message": "remove Success and insert newdata Success", "authURL": authURL };
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error };
                                    res.send(returnInfo);
                                }
                            });
                        } else {
                            returnInfo = { "state": "-1", "message": error1 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则插入数据库
                    var newData = { "f_token": token, "f_chanid": channelID, "f_key": key, "f_ts": ts, "f_uri": uri, "f_busy": "" };
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_user_auth_livetv", newData, function(state, error, result) {
                        //console.log("insert");
                        if (state == "0") {
                            returnInfo = { "state": "0", "message": "remove Success and insert newdata Success", "authURL": authURL };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        res.send({ "code": "-1", "desc": "param is not compelete" });
    }
});

/* 
 * @desc : 点播播放链接鉴权接口转发
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/authVod', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    //var STREAM_LIVE = req["query"]["STREAM_LIVE"];
    var realURL = req["query"]["realURL"]; //"http://192.168.19.14:2000/vodfiles/amfy/amfy3.mp4";
    var uri = req["query"]["uri"];
    var token = req["query"]["token"];
    var vid = req["query"]["vid"];
    var port = req["query"]["port"];
    var playtime = req["query"]["playtime"];
    //var playtime = req["query"]["playtime"];
    /*playtime = 7776000;
    if(token =="" || token == null){
    	var num = randomWord(false,12);
    	token = "usertest_"+num;
    	playtime = 360;
    }*/
    //console.log(token !="" && token != null && uri !="" && uri != null && vid != "" && vid != null);
    if (token != "" && token != null && uri != "" && uri != null && vid != "" && vid != null && playtime != "" && playtime != null) {
        //var GO3C_URL = STREAM_LIVE+uri;
        var timestamp = Date.parse(new Date());
        timestamp = timestamp / 1000 + playtime;
        timestamp = timestamp.toString();
        var ts = util_common.base64Encode(timestamp);
        var MD5sum = uri + token + timestamp
        var key = util_common.base64Encode(util_common.MD5sumfunction(MD5sum));
        var authURL = realURL + "?token=" + token + "&key=" + key + "&ts=" + ts;
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_auth_vod", { "f_token": token }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则直接返回error信息
                    //returnInfo = {"state":"-1","message":"Repeated collection"};
                    //res.send(returnInfo);
                    mongodbUtil.commonRemove(DB_CONN_STR, "t_user_auth_vod", { "f_token": token }, function(state1, error1, result1) {
                        if (state1 == "0") {
                            var newData = { "f_token": token, "f_vid": vid, "f_key": key, "f_ts": ts, "f_uri": uri, "f_busy": "" };
                            mongodbUtil.commonInsert(DB_CONN_STR, "t_user_auth_vod", newData, function(state, error, result) {
                                //console.log("delete insert");
                                if (state == "0") {
                                    returnInfo = { "state": "0", "message": "remove Success and insert newdata Success", "authURL": authURL };
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error };
                                    res.send(returnInfo);
                                }
                            });
                        } else {
                            returnInfo = { "state": "-1", "message": error1 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则插入数据库
                    var newData = { "f_token": token, "f_vid": vid, "f_key": key, "f_ts": ts, "f_uri": uri, "f_busy": "" };
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_user_auth_vod", newData, function(state, error, result) {
                        //console.log("insert");
                        if (state == "0") {
                            returnInfo = { "state": "0", "message": "remove Success and insert newdata Success", "authURL": authURL };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        res.send({ "code": "-1", "desc": "param is not compelete" });
    }
});


/* 
 * @desc : 终端操作数据库-修改busy状态
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/auth/updatebusystatus', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var key = req["query"]["key"];
    var busy = req["query"]["busy"];
    var returnInfo;
    logInfo.info("终端操作数据库-修改busy状态 start")
    logInfo.info("key="+key);
    logInfo.info("busy="+busy);
    if (key != null && key != "" && busy != null && busy != "") {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_auth_livetv", { "f_key": key }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则返回卡号
                    var _id = result[0]["_id"];

                    var updateData = result[0];
                    updateData["f_busy"] = busy;

                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_auth_livetv", { "_id": _id }, updateData, function(state2, error2, result2) {
                        if (state2 == "0") {
                            returnInfo = { "state": "0", "message": "success busystate=" + busy };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error2 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果key不存在则返回不存在
                    returnInfo = { "state": "-1", "message": "key is not exist" };
                    res.send(returnInfo);
                }
            } else {
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "key and busy is undefined" };
        res.send(returnInfo);
    }
    logInfo.info("终端操作数据库-修改busy状态 end")
});


/*
 * @desc : 通知网关WAN状态
 * @params : req-请求 res-响应
 * @return : 暂无
 */

app.get('/network', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    var wan = req["query"]["wan"];
    var returnInfo = "";
    /*if(wan == "up"){
    	mongodbUtil.commonSelect(DB_CONN_STR,"t_wan_status",{"f_wan_status":"on"},function(state,error,result){
    		if(state == "0"){//数据库操作正确执行
    			if(result != null && result.length >0){//如果存在则
    				
    			}else{
    				
    			}
    			go3c_server.go3c_on_wan_up();
    			returnInfo = {"state":"0","message":"wanup"};
    		}else{//数据库操作出现错误
    			returnInfo = {"state":"-1","message":error};
    			res.send(returnInfo);
    		}
    	});
    	
    }else if(wan == "down"){
    	go3c_on_wan_down();
    	returnInfo = {"state":"0","message":"wandown"};
    }*/
    mongodbUtil.commonSelect(DB_CONN_STR, "t_wan_status", {}, function(state, error, result) {
        if (state == "0") { //数据库操作正确执行
            if (result != null && result.length > 0) { //如果存在则
                var _id = result[0]["_id"];
                var updateData = result[0];
                updateData["f_wan_status"] = wan;
                mongodbUtil.commonUpdate(DB_CONN_STR, "t_wan_status", { "_id": _id }, updateData, function(state1, error1, result1) {
                    if (state1 == "0") {
                        returnInfo = { "state": "0", "message": "success" };
                        res.send(returnInfo);
                    } else {
                        returnInfo = { "state": "-1", "message": error1 };
                        res.send(returnInfo);
                    }
                });
            } else {
                var newData = { "f_wan_status": wan };
                mongodbUtil.commonInsert(DB_CONN_STR, "t_wan_status", newData, function(state2, error2, result2) {
                    if (state2 == "0") {
                        returnInfo = { "state": "0", "message": "success" };
                        res.send(returnInfo);
                    } else {
                        returnInfo = { "state": "-1", "message": error };
                        res.send(returnInfo);
                    }
                });
            }
        } else { //数据库操作出现错误
            returnInfo = { "state": "-1", "message": error };
            res.send(returnInfo);
        }
    });
    if (wan == "up") {
        //timerTask.timerSchedule();
    } else if (wan == "down") {
        //go3c_server.go3c_on_wan_down();
    }
});


app.get('/vod/cacheData', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    //获取get数据
    var media_version = req["query"]["media_version"];
    var gid = req["query"]["gid"];
    var scene = req["query"]["scene"];
    var area = req["query"]["area"];
    var spid = req["query"]["spid"];
    var uuid = req["query"]["uuid"];
    logInfo.info("media_version=" + media_version);
    var returnInfo; //返回信息
    /*media_version = "1.0.0";
    gid = "00002.0010";
    scene = "03";
    area = "any";
    spid = "sinoscreens";
    uuid = "00000027";*/
    //vod数据缓存获取版本号和实体名
    if (media_version != null && media_version != "" && gid != null && gid != "" && scene != null && scene != "" && area != null && area != "" && spid != "" && spid != null && uuid != "" && uuid != null) {
        //console.log("vodcache");
        go3c_server.vodDataCache(media_version, gid, scene, area, spid, uuid);
        returnInfo = { "state": "0", "message": "success" };
        res.send(returnInfo);
    } else {
        returnInfo = { "state": "-1", "message": "media_version and gid and scene and area and spid is undefined" };
        res.send(returnInfo);
    }
});


/* 
 * @desc : 开始I帧截图
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/timerScheduleForSnapShot/start', function(req, res) {
    //测试数据
    var testJson = {

    };
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    //获取get数据
    var time = req["query"]["time"];

    var returnInfo; //返回信息
    returnInfo = { "state": "0", "message": "开始截图" };
    //console.log(returnInfo);
    //获取nodejs配置文件（组、区域、场景等数据）
    var nodejs_conf = get_go3c_nodejs_conf();
    var gid = nodejs_conf["GROUPID"];
    var scene = nodejs_conf["SCENE"];
    var area = nodejs_conf["AREA"];
    //获取直播列表配置文件(包括频道id、频道名、尺寸大小、存放路径、图片名)
    var jsonObj = get_livetv_conf();
    //直播图片存在路径
    var path = jsonObj[0]['path'].substr(18, jsonObj[0]['path'].length);
    path = path.substr(0, path.length - 1);
    //console.log("242424path=" + path);
    var srcCopy = "/home/wwwroot/default/webapp/livetv" + path;
    var dstCopy = jsonObj[0]['path'].substr(0, jsonObj[0]['path'].length - 1);
    var shell = "/go3c/nodeapps/API_NODEJS/do_snapshot_start.sh" + " " + srcCopy + " " + dstCopy;
    dataCacheUtil.util_common_shell(shell, function(flag) {
        //console.log("copyFileflag=" + flag);
        if (flag == "0") {
            //console.log(1111);
            returnInfo = { "state": "0", "message": "success" };
            //console.log(returnInfo);
            //调用截图定时任务
            timerTask.timerScheduleForSnapShot(time);
            res.send(returnInfo);
        } else {
            returnInfo = { "state": "-1", "message": "fail" };
            //console.log(returnInfo);
            res.send(returnInfo);
        }
    });

});




/*
 * @desc : 停止I帧截图
 * @params : req-请求 res-响应
 * @return : 暂无
 */

app.get('/timerScheduleForSnapShot/stop', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    //console.log("11111");
    //var wan = req["query"]["wan"];
    logInfo.info("停止I帧截图 start")
    var returnInfo = "";
    returnInfo = { "state": "0", "message": "停止截图" };
    res.send(returnInfo);
    //console.log("stop");
    //直播图片存在路径
    var jsonObj = get_livetv_conf();
    var path = jsonObj[0]['path'].substr(18, jsonObj[0]['path'].length);
    path = path.substr(0, path.length - 1);
    logInfo.info("path=" + path);
    //调用取消截图方法
    timerTask.util_snapShotStop(path);
    logInfo.info("停止I帧截图 end")
});


/* 
 * @desc : 用户登记(POST)
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.post('/user/register', function(req, res) {

    //获取post数据
    var body = req.body;

    var name = body["name"];
    var alias = body["alias"];
    //var idtag = body["idtag"];
    var ip = body["ip"];
    var f_phone = body["f_phone"];
    var f_email = body["f_email"];
    var t_terminal_uuid = body["t_terminal_uuid"];
    var session = body["session"];
    var openid = body["openid"];
    var returnInfo; //返回信息
    //获取nodejs配置文件（组、区域、场景等数据）
    var nodejs_conf = get_go3c_nodejs_conf();
    var groupid = nodejs_conf["GROUPID"];
    var scene = nodejs_conf["SCENE"];
    var areaid = nodejs_conf["AREA"];
    var UUID = nodejs_conf["UUID"];

    //设置默认值
    if (alias == null || alias.length == 0) {
        alias = "";
    }
    if (groupid == null || groupid.length == 0) {
        groupid = "";
    }
    if (areaid == null || areaid.length == 0) {
        areaid = "";
    }
    if (ip == null || ip.length == 0) {
        ip = "";
    }
    if (f_phone == null || f_phone.length == 0) {
        f_phone = "";
    }
    if (f_email == null || f_email.length == 0) {
        f_email = "";
    }
    if (t_terminal_uuid == null || t_terminal_uuid.length == 0) {
        t_terminal_uuid = "";
    }

    if (session != null && session.length > 0) { //登记的账号不能为空
        //根据账号name查询是否已经存在,如果存在则直接返回name，如果不存在则插入数据库
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user", { "session": session }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则直接返回name
                    returnInfo = { "state": "-1", "message": "session is already use", "session": result[0]["session"] };
                    res.send(returnInfo);
                } else { //如果不存在则插入数据库
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var newData = {
                        "name": name,
                        "alias": alias,
                        "f_phone": f_phone,
                        "f_email": f_email,
                        "f_areaid": areaid,
                        "f_wanip": ip,
                        "f_groupid": groupid,
                        "t_terminal_uuid": t_terminal_uuid,
                        "f_uuid": UUID,
                        "session": session,
                        "createtime": time,
                        "openid": openid,
                        "updatetime": "",
                        "listorder": 0
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_user", newData, function(state, error, result) {
                        if (state == "0") {
                            returnInfo = { "state": "0", "message": "Success", "name": name };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "params is undefined" };
        res.send(returnInfo);
    }
});


app.get('/user/register', function(req, res) {

    //获取post数据
    var body = req.query;

    var name = body["name"];
    var alias = body["alias"];
    //var idtag = body["idtag"];
    var ip = body["ip"];
    var f_phone = body["f_phone"];
    var f_email = body["f_email"];
    var t_terminal_uuid = body["t_terminal_uuid"];
    var session = body["session"];
    var openid = body["openid"];
    var returnInfo; //返回信息
    //获取nodejs配置文件（组、区域、场景等数据）
    var nodejs_conf = get_go3c_nodejs_conf();
    var groupid = nodejs_conf["GROUPID"];
    var scene = nodejs_conf["SCENE"];
    var areaid = nodejs_conf["AREA"];
    var UUID = nodejs_conf["UUID"];

    //设置默认值
    if (alias == null || alias.length == 0) {
        alias = "";
    }
    if (groupid == null || groupid.length == 0) {
        groupid = "";
    }
    if (areaid == null || areaid.length == 0) {
        areaid = "";
    }
    if (ip == null || ip.length == 0) {
        ip = "";
    }
    if (f_phone == null || f_phone.length == 0) {
        f_phone = "";
    }
    if (f_email == null || f_email.length == 0) {
        f_email = "";
    }
    if (t_terminal_uuid == null || t_terminal_uuid.length == 0) {
        t_terminal_uuid = "";
    }

    if (session != null && session.length > 0) { //登记的账号不能为空
        //根据账号name查询是否已经存在,如果存在则直接返回name，如果不存在则插入数据库
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user", { "session": session }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则直接返回name
                    returnInfo = { "state": "-1", "message": "session is already use", "session": result[0]["session"] };
                    res.send(returnInfo);
                } else { //如果不存在则插入数据库
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var newData = {
                        "name": name,
                        "alias": alias,
                        "f_phone": f_phone,
                        "f_email": f_email,
                        "f_areaid": areaid,
                        "f_wanip": ip,
                        "f_groupid": groupid,
                        "t_terminal_uuid": t_terminal_uuid,
                        "f_uuid": UUID,
                        "session": session,
                        "createtime": time,
                        "openid": openid,
                        "updatetime": "",
                        "listorder": 0
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_user", newData, function(state, error, result) {
                        if (state == "0") {
                            returnInfo = { "state": "0", "message": "Success", "name": name };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "params is undefined" };
        res.send(returnInfo);
    }
})

/* 
 * @desc : 点播观看历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/vod/add', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"];
    var vid = req["query"]["vid"];
    var videoNumber = req["query"]["videoNumber"];
    var termid = req["query"]["termid"];
    var areaid = req["query"]["area"];
    var videoname = req["query"]["videoname"];
    var columnid = req["query"]["columnid"];
    var imageurl = req["query"]["imageurl"];
    var openid = req["query"]["openid"];
    var playtime=req["query"]["playtime"]; //xiaoliu add 2017-5-5
    
    var returnInfo;
    
    var str=".";
    vid=vid.split(str)[0]; //视频id去掉分集
    time = getCurTime("yyyy-MM-dd hh:mm:ss");
    if ((userID != null && userID.length > 0) && (vid != null && vid.length > 0)) {
        //记录点播观看最新历史
        var newData = {
            "f_vid": vid,
            "f_id": userID,
            "f_datetime": time,
            "f_epsode": videoNumber,
            "f_pos": areaid,
            "videoname": videoname,
            "columnid": columnid,
            "imageurl": imageurl,
            "createtime": time,
            "openid": openid,
            "termid":termid,    //xiaoliu add 2017-4-7
            "playtime":playtime, //xiaoliu add 2017-5-5
            "f_uuid": "",
            "listorder": "",
        }
       
        mongodbUtil.commonInsert(DB_CONN_STR, "t_user_history_video_log", newData, function(state1, error1, result1) {
            if (state1 == "0") {
                //记录点播观看历史日志
                //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
             //mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_video", { "f_id": userID, "f_vid": vid }, function(state, error, result) {
	        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_video", { "termid":termid,"openid": openid, "f_vid": vid }, function(state, error, result){  //xiaoliu 修改查询条件  
                    if (state == "0") { //数据库操作正确执行
                        if (result != null && result.length > 0) { //如果存在则跟新信息的时间
                            var _id = result[0]["_id"];
                            var updateData = result[0];
                            updateData["f_datetime"] = time;
                            //updateData["createtime"] = time;
                            updateData["playtime"] = playtime;
                            updateData["f_epsode"] = videoNumber;
                            mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_history_video", { "_id": _id }, updateData, function(state3, error3, result3) {
                                if (state3 == "0") {
                                    returnInfo = { "state": "0", "message": "update success" };
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error3 };
                                    res.send(returnInfo);
                                }
                            });
                        } else { //如果不存在则插入数据库
                            mongodbUtil.commonInsert(DB_CONN_STR, "t_user_history_video", newData, function(state2, error2, result2) {
                                if (state2 == "0") {
                                    returnInfo = { "state": "0", "message": "collection video Success" };
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error2 };
                                    res.send(returnInfo);
                                }
                            });
                        }
                    }
                });
            } else {
                returnInfo = { "state": "-1", "message": error1 };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID or vid or termid is undefined" };
        res.send(returnInfo);
    }
});


/* 
 * @desc : 直播观看历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/livetv/add', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    var userID = req["query"]["userID"];
    var channelID = req["query"]["channelID"];
    var channelName = req["query"]["channelName"];
    var channeImgUrl = req["query"]["channeImgUrl"];
    var termid = req["query"]["termid"];
    var openid = req["query"]["openid"];
    var t_terminal_uuid = req["query"]["t_terminal_uuid"];
    var returnInfo;

    if (openid != null || openid.length > 0 && channelID != null || channelID.length > 0) {
        time = getCurTime("yyyy-MM-dd hh:mm:ss");
        var newData = {
            "f_chanid": channelID,
            "f_id": userID,
            "f_datetime": time,
            "createtime": time,
            "channelName": channelName,
            "channeImgUrl": channeImgUrl,
            "f_uuid": t_terminal_uuid,
            "openid": openid,
            "termid":termid, //xiauliu add 2017-4-7
            "listorder": "",
        }
        mongodbUtil.commonInsert(DB_CONN_STR, "t_user_history_livetv_log", newData, function(state1, error1, result1) {
            if (state1 == "0") {
                //记录直播观看历史日志
                //通过userid、channelID和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
                /*mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_livetv", { "f_id": userID, "f_chanid": channelID }, function(state, error, result) {*/
                mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_livetv", {"termid":termid,"openid":openid,"f_chanid":channelID }, function(state, error, result) {//xiaoliu 2017-4-7修改查询条件
                    if (state == "0") { //数据库操作正确执行
                        if (result != null && result.length > 0) { //如果存在则跟新信息的时间
                            var _id = result[0]["_id"];
                            var updateData = result[0];
                            updateData["f_datetime"] = time;
                            updateData["createtime"] = time;
                            mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_history_livetv", { "_id": _id }, updateData, function(state3, error3, result3) {
                                if (state3 == "0") {
                                    returnInfo = { "state": "0", "message": "update success" };
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error3 };
                                    res.send(returnInfo);
                                }
                            });
                        } else { //如果不存在则插入数据库
                            mongodbUtil.commonInsert(DB_CONN_STR, "t_user_history_livetv", newData, function(state2, error2, result2) {
                                if (state2 == "0") {
                                    returnInfo = { "state": "0", "message": "collection livetv Success" };
                                    res.send(returnInfo);
                                } else {
                                    returnInfo = { "state": "-1", "message": error2 };
                                    res.send(returnInfo);
                                }
                            });
                        }
                    }
                });
            } else {
                returnInfo = { "state": "-1", "message": error1 };
                res.send(returnInfo);
            }
        });
    } else {
        //console.log(11111);
        returnInfo = { "state": "-1", "message": "openid or channelID is undefined" };
        res.send(returnInfo);
    }
});


/* 
 * @desc : 用户购买历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/buy/add', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    var userID = req["query"]["userID"];
    var f_order_id = req["query"]["f_order_id"];
    var product_id = req["query"]["product_id"];
    var f_name = req["query"]["f_name"];
    var f_desc = req["query"]["f_desc"];
    var termid = req["query"]["termid"];
    var f_token = req["query"]["f_token"];
    var f_status = req["query"]["status"];
    var openid = req["query"]["openid"];
    var f_type = req["query"]["f_type"];
    var returnInfo;

    if (userID != null || userID.length > 0 && f_order_id != null || f_order_id.length > 0) {
        //通过userid、f_order_id判断指定用户/订单是已存在，如果存在则则表示下单没有支付继续支付，如果不存在则插入数据库
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_buy", { "f_id": userID, "f_order_id": f_order_id }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则跟新观看时间信息
                    var _id = result[0]["_id"];
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var updateData = result[0];
                    updateData["updatetime"] = time;
                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_history_buy", { "_id": _id }, updateData, function(state4, error4, result4) {
                        if (state4 == "0") {
                            returnInfo = { "state": "0", "message": "success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error4 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则插入数据库
                    var time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var newData = {
                        "f_order_id": f_order_id,
                        "f_id": userID,
                        "createtime": time,
                        "f_desc": f_desc,
                        "f_token": f_token,
                        "product_id": product_id,
                        "f_name": f_name,
                        "f_status": f_status,
                        "openid": openid,
                        "f_type": f_type,
                        "listorder": "",
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_user_history_buy", newData, function(state1, error1, result1) {
                        if (state1 == "0") {
                            returnInfo = { "state": "0", "message": "record video Success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error1 };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        //console.log(111);
        returnInfo = { "state": "-1", "message": "userID or vid or termid is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 在线用户登录记录(POST)
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.post('/user/account/loginonline', function(req, res) {

    //获取post数据
    var body = req.body;

    var name = body["name"];
    var f_token = body["f_token"]; //openid
    var f_uuid = body["f_uuid"];
    var f_last_wanip = body["f_last_wanip"];
    var f_last_area = body["f_last_area"];
    var f_login_type = body["f_login_type"];

    //获取nodejs配置文件（组、区域、场景等数据）
    var nodejs_conf = get_go3c_nodejs_conf();
    var groupid = nodejs_conf["GROUPID"];
    var f_spid = nodejs_conf["SPID"];
    //var areaid = nodejs_conf["AREA"];
    var f_gateway_uuid = nodejs_conf["UUID"];
    time = getCurTime("yyyy-MM-dd hh:mm:ss");

    if (name != null && name.length > 0 && f_token != null && f_token.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_login", { "name": name, "f_token": f_token, "f_gateway_uuid": f_gateway_uuid, "f_login_type": f_login_type }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则跟新
                    var _id = result[0]["_id"];
                    var updateData = result[0];
                    updateData["updatetime"] = time;
                    updateData["createtime"] = time;
                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_login", { "_id": _id }, updateData, function(state3, error3, result3) {
                        if (state3 == "0") {
                            returnInfo = { "state": "0", "message": "success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error3 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则新增一条记录
                    var newData = {
                        "name": name,
                        "f_token": f_token,
                        "f_uuid": f_uuid,
                        "f_last_wanip": f_last_wanip,
                        "f_last_area": f_last_area,
                        "f_login_type": f_login_type,
                        "f_gateway_uuid": f_gateway_uuid,
                        "f_spid": f_spid,
                        "groupid": groupid,
                        "createtime": time,
                        "f_datetime": time,
                        "f_cancel_time": "",
                        "listorder": "",
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_user_login", newData, function(state1, error1, result1) {
                        if (state1 == "0") {
                            returnInfo = { "state": "0", "message": "record video Success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error1 };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "name or token is undefined" };
        res.send(returnInfo);
    }
});


app.get('/user/account/loginonline', function(req, res) {

    //获取post数据
    var body = req.query;

    var name = body["name"];
    var f_token = body["f_token"]; //openid
    var f_uuid = body["f_uuid"];
    var f_last_wanip = body["f_last_wanip"];
    var f_last_area = body["f_last_area"];
    var f_login_type = body["f_login_type"];

    //获取nodejs配置文件（组、区域、场景等数据）
    var nodejs_conf = get_go3c_nodejs_conf();
    var groupid = nodejs_conf["GROUPID"];
    var f_spid = nodejs_conf["SPID"];
    //var areaid = nodejs_conf["AREA"];
    var f_gateway_uuid = nodejs_conf["UUID"];
    time = getCurTime("yyyy-MM-dd hh:mm:ss");

    if (name != null && name.length > 0 && f_token != null && f_token.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_login", { "name": name, "f_token": f_token, "f_gateway_uuid": f_gateway_uuid, "f_login_type": f_login_type }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则跟新
                    var _id = result[0]["_id"];
                    var updateData = result[0];
                    updateData["updatetime"] = time;
                    updateData["createtime"] = time;
                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_login", { "_id": _id }, updateData, function(state3, error3, result3) {
                        if (state3 == "0") {
                            returnInfo = { "state": "0", "message": "success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error3 };
                            res.send(returnInfo);
                        }
                    });
                } else { //如果不存在则新增一条记录
                    var newData = {
                        "name": name,
                        "f_token": f_token,
                        "f_uuid": f_uuid,
                        "f_last_wanip": f_last_wanip,
                        "f_last_area": f_last_area,
                        "f_login_type": f_login_type,
                        "f_gateway_uuid": f_gateway_uuid,
                        "f_spid": f_spid,
                        "groupid": groupid,
                        "createtime": time,
                        "f_datetime": time,
                        "f_cancel_time": "",
                        "listorder": "",
                    }
                    mongodbUtil.commonInsert(DB_CONN_STR, "t_user_login", newData, function(state1, error1, result1) {
                        if (state1 == "0") {
                            returnInfo = { "state": "0", "message": "record video Success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error1 };
                            res.send(returnInfo);
                        }
                    });
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "name or token is undefined" };
        res.send(returnInfo);
    }
})

/* 
 * @desc : 在线用户退出登录(POST)
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.post('/user/account/loginout', function(req, res) {
    //获取post数据
    var body = req.body;
    var name = body["name"];
    var f_token = body["f_token"]; //openid
    var f_login_type = body["f_login_type"];

    if (name != null && name.length > 0 && f_token != null && f_token.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_login", { "f_token": f_token, "f_login_type": f_login_type }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则跟新
                    var _id = result[0]["_id"];
                    time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var updateData = result[0];
                    updateData["createtime"] = time;
                    updateData["f_cancel_time"] = time;
                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_login", { "_id": _id }, updateData, function(state3, error3, result3) {
                        if (state3 == "0") {
                            returnInfo = { "state": "0", "message": "success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error3 };
                            res.send(returnInfo);
                        }
                    });
                } else {
                    returnInfo = { "state": "-2", "message": error };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-3", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-4", "message": "name or token is undefined" };
        res.send(returnInfo);
    }
});


app.get('/user/account/loginout', function(req, res) {
    //获取post数据
    var body = req.query;
    var name = body["name"];
    var f_token = body["f_token"]; //openid
    var f_login_type = body["f_login_type"];

    if (name != null && name.length > 0 && f_token != null && f_token.length > 0) {
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_login", { "f_token": f_token, "f_login_type": f_login_type }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                if (result != null && result.length > 0) { //如果存在则跟新
                    var _id = result[0]["_id"];
                    time = getCurTime("yyyy-MM-dd hh:mm:ss");
                    var updateData = result[0];
                    updateData["createtime"] = time;
                    updateData["f_cancel_time"] = time;
                    mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_login", { "_id": _id }, updateData, function(state3, error3, result3) {
                        if (state3 == "0") {
                            returnInfo = { "state": "0", "message": "success" };
                            res.send(returnInfo);
                        } else {
                            returnInfo = { "state": "-1", "message": error3 };
                            res.send(returnInfo);
                        }
                    });
                } else {
                    returnInfo = { "state": "-2", "message": error };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-3", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-4", "message": "name or token is undefined" };
        res.send(returnInfo);
    }
})


/* 
 * @desc : 点播历史记录-获取历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/vod/get', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"]; //userID和openid一致 xiaoliu add 2017-4-8
    var termid = req["query"]["termid"];
    var returnInfo;
    // console.log(userID);
    if ((userID != null && userID.length > 0) && (termid != null && termid.length > 0)) {
       mongodbUtil.commonRemove(DB_CONN_STR,"t_user_history_video",{"f_vid":"null"},function(state7,error7,result7){
			if(state7=="0"){
						    //通过userid和termid查询指定用户的浏览历史记录
     mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_video",{ $query: { "f_id": userID,"termid":termid }, $orderby: { f_datetime: -1 } }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                //console.log(result);
                if (result != null && result.length > 0) {
						 ////////////////////xiaoliu add 2017-4-6//////////////////////////
	                var endflag=0;
	                var tmp='';
	                var data=new Array();
					result.map((issue)=>{
						var f_vid=issue.f_vid;
						var termid=issue.termid;
						var play_time=issue.playtime || '';
						var videoNumber=issue.f_epsode ||'';
						var f_datetime=issue.f_datetime||'';
						if(videoNumber.length>0){
						f_vid=f_vid+"."+videoNumber;
						//console.log(f_vid);
						var data1={"f_vid":f_vid,"playtime":play_time,"f_epsode":videoNumber,"f_datetime":f_datetime,"termid":termid};
						data.push(data1);
						console.log("++++++++++++++++"+data.termid);
						tmp=tmp+f_vid+',';
						endflag=endflag+1;
						if(endflag==result.length){
							tmp=tmp.slice(0,tmp.length-1);
							var url="http://www.go3c.tv:8030/backend/mobileott/api/php/php_video_list.php?vids="+tmp;
							console.log(url);
								request({
								    url: url,
								    method: "GET",
								    json: true,
								    headers: {
								    "content-type": "application/json",
								    }}, function(error, response, body) {
								    if (!error && response.statusCode == 200) {
									    var fflag=0;
									    data.map((issue1)=>{
											var vvid=issue1.f_vid;
											var ttermid=issue1.termid;
											var pptime=issue1.playtime;
											var vnum=issue1.f_epsode;
											var ttttmie=issue1.f_datetime;
											//vvid=vvid+vnum;
											response.body.map((issue2)=>{
												
												if(vvid==issue2.ID){
													fflag=fflag+1;
													issue2.playtime=pptime||'';	
													issue2.videoNumber=vnum ||'';
													issue2.f_datetime=ttttmie||'';
													issue2.termid=ttermid||'';
													if(fflag==data.length){
														//console.log(response.bo)
										returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body};
                    					res.send(returnInfo);								
													}																				
												}																	
											})							
										    
									    })
									    
									    //returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body,"playtime":data};
                    					//res.send(returnInfo);
									    //res.send(response.body)
								    }else{
									    returnInfo = { "state": "-1", "message": "内部获取数据出错！"};
                    					res.send(returnInfo);
								    }
								});													
						  }																				    							
                          }else{
	                          var data1={"f_vid":f_vid,"playtime":play_time,"f_epsode":videoNumber,"f_datetime":f_datetime,"termid":termid};
						data.push(data1);
						tmp=tmp+f_vid+',';
						endflag=endflag+1;
						if(endflag==result.length){
							tmp=tmp.slice(0,tmp.length-1);
							var url="http://www.go3c.tv:8030/backend/mobileott/api/php/php_video_list.php?vids="+tmp;
							//console.log(url);
								request({
								    url: url,
								    method: "GET",
								    json: true,
								    headers: {
								    "content-type": "application/json",
								    }}, function(error, response, body) {
								    if (!error && response.statusCode == 200) {
									    var fflag=0;
									    data.map((issue1)=>{
											var vvid=issue1.f_vid;
											var ttermid=issue1.termid;
											var pptime=issue1.playtime;
											var vnum=issue1.f_epsode;
											var ttttmie=issue1.f_datetime;
											//vvid=vvid+vnum;
											response.body.map((issue2)=>{
												
												if(vvid==issue2.ID){
													fflag=fflag+1;
													issue2.playtime=pptime||'';	
													issue2.videoNumber=vnum ||'';
													issue2.f_datetime=ttttmie||'';
													issue2.termid=ttermid||""
													if(fflag==data.length){
														console.log(response.bo)
										returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body};
                    					res.send(returnInfo);								
													}																				
												}																	
											})							
										    
									    })
									    
									    //returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body,"playtime":data};
                    					//res.send(returnInfo);
									    //res.send(response.body)
								    }else{
									    returnInfo = { "state": "-1", "message": "内部获取数据出错！"};
                    					res.send(returnInfo);
								    }
								});													
						  }																				    							
                          
                          }
						})		

                   
                } else {
                    returnInfo = { "state": "-1", "message": "userID无记录！" };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
     	
			}else{
				returnInfo = { "state": "-1", "message": error7};
                res.send(returnInfo);
			}
	       
       })
    } else {
        returnInfo = { "state": "-1", "message": "userID is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 点播历史记录-删除历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/vod/delete', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"];
    var vid = req["query"]["vid"];
    var termid = req["query"]["termid"];
    var returnInfo;
    var i = 0;
    
    if (userID != null || userID.length > 0 && vid != null || vid.length > 0 && termid != null || termid.length > 0) {
        //多个vid值，存在数组中
        if (vid.indexOf(",") != -1) {
            var vodArray = vid.split(",");
            vodArray.forEach(function(v) {
	            v=v.split('.')[0];
	            //console.log("++++++++"+v)
            mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_video", { "termid":termid,"f_id": userID, "f_vid": v }, function(state, error, result) {  //
                    //console.log("===========" + v);
                    if (state == "0") { //数据库操作正确执行
                        //console.log(result);
                        if (result != null && result.length > 0) { //如果存在则直接返回error信息
                            mongodbUtil.commonRemove(DB_CONN_STR, "t_user_history_video", { "termid":termid,"f_id": userID, "f_vid": v }, function(state1, error1, result1) { //xiaoliu 修改查询条件
                                if (state1 == "0") {
                                    returnInfo = { "state": "0", "message": "remove Success" };
                                    i = i + 1;
                                    if (i == vodArray.length) {
                                        res.send(returnInfo);
                                    }
                                }
                            });
                        } else {
                            returnInfo = { "state": "-1", "message": "result is []" };
                            i = i + 1;
                            if (i == vodArray.length) {
                                res.send(returnInfo);
                            }
                            //res.send(returnInfo);
                        }
                    } else { //数据库操作出现错误
                        returnInfo = { "state": "-1", "message": error };
                        i = i + 1;
                        if (i == vodArray.length) {
                            res.send(returnInfo);
                        }
                    }
                });
            });
        } else {
	         vid=vid.split('.')[0];
            //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
            mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_video", { "f_id": userID, "f_vid": vid }, function(state, error, result) {
                if (state == "0") { //数据库操作正确执行
                    if (result != null && result.length > 0) { //如果存在则直接返回error信息
                        mongodbUtil.commonRemove(DB_CONN_STR, "t_user_history_video", { "f_id": userID, "f_vid": vid }, function(state1, error1, result1) {
                            if (state1 == "0") {
                                returnInfo = { "state": "0", "message": "remove Success" };
                                res.send(returnInfo);
                            } else {
                                returnInfo = { "state": "-1", "message": error1 };
                                res.send(returnInfo);
                            }
                        });
                    } else {
                        returnInfo = { "state": "-1", "message": "userID or vid is undefined" };
                        res.send(returnInfo);
                    }
                } else { //数据库操作出现错误
                    returnInfo = { "state": "-1", "message": error };
                    res.send(returnInfo);
                }
            });
        }
    } else {
        returnInfo = { "state": "-1", "message": "userID or vid  is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 点播历史记录-清空历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/vod/clear', function(req, res) {
    var userID = req["query"]["userID"];
    var termid = req["query"]["termid"];
    var returnInfo;

    if (userID != null || userID.length > 0 && termid != null || termid.length > 0) {
        mongodbUtil.commonRemove(DB_CONN_STR, "t_user_history_video", { "termid":termid,"f_id": userID }, function(state1, error1, result1) {
            if (state1 == "0") {
                returnInfo = { "state": "0", "message": "remove Success" };
                res.send(returnInfo);
            } else {
                returnInfo = { "state": "-1", "message": error1 };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 直播历史记录-获取历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/livetv/get', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"];
    var termid = req["query"]["termid"];
    var returnInfo;
    // console.log(userID);
    if (userID != null || userID.length > 0 && termid != null || termid.length > 0) {
        //通过userid和termid查询指定用户的浏览历史记录
        mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_livetv", { $query: { "termid":termid,"f_id": userID }, $orderby: { f_datetime: -1 } }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                //console.log(result);
                if (result != null && result.length > 0) {
                    returnInfo = { "state": "0", "message": "获取成功！", "videolist": result };
                    res.send(returnInfo);
                } else {
                    returnInfo = { "state": "-1", "message": "userID or timeperiod is undefined" };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID is undefined" };
        res.send(returnInfo);
    }
});
/* 
 * @desc : 直播历史记录-删除历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
//定义删除vod   userID是用户id，channelID是直播频道id，termid是终端类型

app.get('/user/history/livetv/delete', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    var userID = req["query"]["userID"];
    var channelID = req["query"]["channelID"];
    var termid = req["query"]["termid"];
    var returnInfo;
    var i = 0;
    //console.log(userID);
    //console.log(channelID);
    if (userID != null || userID.length > 0 && channelID != null || channelID.length > 0) {
        //多个channelID值，存在数组中
        if (channelID.indexOf(",") != -1) {
            var channelArray = channelID.split(",");
            channelArray.forEach(function(v) {
                mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_livetv", {"termid":termid,"f_id": userID, "f_chanid": v }, function(state, error, result) {
                    if (state == "0") { //数据库操作正确执行
                        if (result != null && result.length > 0) { //如果存在则直接返回error信息
                            mongodbUtil.commonRemove(DB_CONN_STR, "t_user_history_livetv", {"termid":termid, "f_id": userID, "f_chanid": v }, function(state1, error1, result1) {
                                if (state1 == "0") {
                                    returnInfo = { "state": "0", "message": "remove Success" };
                                    i = i + 1;
                                    if (i == channelArray.length) {
                                        res.send(returnInfo);
                                    }
                                }
                            });
                        } else {
                            returnInfo = { "state": "-1", "message": "result is []" };
                            i = i + 1;
                            if (i == channelArray.length) {
                                res.send(returnInfo);
                            }
                            //res.send(returnInfo);
                        }
                    } else { //数据库操作出现错误
                        returnInfo = { "state": "-1", "message": error };
                        i = i + 1;
                        if (i == channelArray.length) {
                            res.send(returnInfo);
                        }
                    }
                });
            });
        } else {
            //console.log(2222);
            //通过userid、vid和termid判断指定用户是否收藏过指定视频，如果存在则返回error信息，如果不存在则插入数据库
            mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_livetv", {"termid":termid, "f_id": userID, "f_chanid": channelID }, function(state, error, result) {
                if (state == "0") { //数据库操作正确执行
                    //console.log(result[0]["f_id"]+"========"+result[0]["f_chanid"]);
                    userID = result[0]["f_id"];
                    channelID = result[0]["f_chanid"];
                    if (result != null && result.length > 0) { //如果存在则直接返回error信息
                        mongodbUtil.commonRemove(DB_CONN_STR, "t_user_history_livetv", {"termid":termid, "f_id": userID, "f_chanid": channelID }, function(state1, error1, result1) {
                            if (state1 == "0") {
                                returnInfo = { "state": "0", "message": "remove Success", "result1": result1, "result": result };
                                res.send(returnInfo);
                            } else {
                                returnInfo = { "state": "-1", "message": error1 };
                                res.send(returnInfo);
                            }
                        });
                    } else {
                        returnInfo = { "state": "-1", "message": "userID or channelID is undefined" };
                        res.send(returnInfo);
                    }
                } else { //数据库操作出现错误
                    returnInfo = { "state": "-1", "message": error };
                    res.send(returnInfo);
                }
            });
        }
    } else {
        returnInfo = { "state": "-1", "message": "userID or channelID  is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 直播历史记录-清空历史记录
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/livetv/clear', function(req, res) {
    var userID = req["query"]["userID"];
    var termid = req["query"]["termid"];
    var returnInfo;

    if (userID != null || userID.length > 0 && termid != null || termid.length > 0) {
        mongodbUtil.commonRemove(DB_CONN_STR, "t_user_history_livetv", {"termid":termid, "f_id": userID }, function(state1, error1, result1) {
            if (state1 == "0") {
                returnInfo = { "state": "0", "message": "remove Success" };
                res.send(returnInfo);
            } else {
                returnInfo = { "state": "-1", "message": error1 };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 用户浏览-添加浏览日志
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/history/scan/add', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["userID"];
    var page_id = req["query"]["page_id"];
    var name = req["query"]["name"];
    var termid = req["query"]["termid"];
    var t_terminal_uuid = req["query"]["t_terminal_uuid"];
    var openid = req["query"]["openid"];
    var returnInfo;
    //console.log(userID);
    if (userID != null && userID.length > 0 && page_id != null && page_id.length > 0 && termid != null && termid.length > 0) {
        time = getCurTime("yyyy-MM-dd hh:mm:ss");
        var newData = {
            "page_id": page_id,
            "f_id": userID,
            "openid": openid,
            "f_datetime": time,
            "name": name,
            "f_uuid": t_terminal_uuid,
            "createtime": time,
            "listorder": "",
        }
        mongodbUtil.commonInsert(DB_CONN_STR, "t_user_scan", newData, function(state2, error2, result2) {
            if (state2 == "0") {
                returnInfo = { "state": "0", "message": "collection Success" };
                res.send(returnInfo);
            } else {
                returnInfo = { "state": "-1", "message": error2 };
                res.send(returnInfo);
            }
        });
    } else {
        returnInfo = { "state": "-1", "message": "userID or page_id or termid is undefined" };
        res.send(returnInfo);
    }
});

/* 
 * @desc : 清除一些数据
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/user/table/delete/*', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var termid = req["query"]["termid"];
    var returnInfo;
    var listorder = "";
    var table = '["t_user_favorite_livetv","t_user_favorite_video","t_user_history_buy","t_user_history_livetv","t_user_history_video","t_user_favorite_livetv_log","t_user_favorite_video_log","t_user_history_livetv_log","t_user_history_video_log"]';
    data = JSON.parse(table);
    data.forEach(function(v) {
        //console.log("***************");
        //console.log(v);
        mongodbUtil.commonRemove(DB_CONN_STR, v, { "listorder": listorder }, function(state1, error1, result1) {});
    });
    returnInfo = { "state": "0", "message": "Success" };
    res.send(returnInfo);
});


/*
 * @desc : 验证刮刮卡token是否有效
 * @params : req-请求 res-响应
 * @return : 暂无
 */
app.get('/go3capi/appValidateTokenServlet', function(req, res) {
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    var appID = req["query"]["appID"];//客户端使用接口版本
    var params = req["query"]["params"]//参数   token   phoneinfo
    //console.log(params)
    if(!params) {
        returnInfo = { "state": "-1", "message": "params为空" };
        res.send(returnInfo);
        return;
    }
    params = JSON.parse(params)
    var token = params.token
    //console.log(token)
    var returnInfo;
    var condition = {"f_token":token}
    if(!token){
        returnInfo = { "state": "-1", "message": "token为空" };
        res.send(returnInfo);
        return;
    }
    mongodbUtil.commonSelect(DB_CONN_STR, "t_card_guagua_status", condition, function(state, error, result) {
        if (state == "0") { //数据库操作正确执行
            //console.log(result[0]["f_id"]+"========"+result[0]["f_chanid"]);
            //console.log(result)
            if (result != null && result.length > 0) { 
                //token有效
                returnInfo = { "state": "0", "from":"gateway","message": "成功","headiconUrl":"","nickname":"","token":""};
                res.send(returnInfo);
            } else {
                //token已失效
                returnInfo = { "state": "1", "from":"gateway","message": "token已失效","headiconUrl":"","nickname":"","token":""};
                res.send(returnInfo);
            }
        } else { //数据库操作出现错误
            returnInfo = { "state": "-1", "message": error };
            res.send(returnInfo);
        }
    });
});

//获取内网ip
app.get('/go3capi/getLocalIp', function(req, res) {
    //res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
    //res.send(getLocalIp.getLocalIP())
    res.send(getIp.getClientIp(req))
});


///////////////////////////////////////////////////////////////////////////////
/*xiaoliu add start*/
/*用户登陆上线接口
参数：userID=xxx&userPWD=xxx&IMEI=xxx&sessionid=xxx&socketid=xxx&usernane=xxx&picture=xxx&weixinopenid=xxx
返回：用户登陆信息
*/
app.get('/user/online',function(req,res){
	res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
	console.log("==================  "+JSON.stringify(req["query"]));
		 var userID = req["query"]["userID"] || '' //手机号
		 var IMEI = req["query"]["IMEI"] || ''  //手机号
		 var userPWD = req["query"]["userPWD"] || '1'
		 var sessionid=req["query"]["sessionid"] || ''
		 var socketid=req["query"]["socketid"] || ''
		 var username=req["query"]["username"] || '1' //昵称
		 var picture=req["query"]["picture"] || '1'  //头像
		 var wx_openid=req["query"]["weixinopenid"] || ''
		 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");
		 var f_newpicture="http://www.go3c.tv:10010/img/default.png";
		 
if(userID.length<=0 || IMEI.length<=0 || userPWD.length<=0 ||sessionid.length<=0 ||socketid.length<=0 ||username.length<=0 ||picture.length<=0)         {
			 returnInfo={"state":"-1","message":"参数错误！"}
			 res.send(returnInfo);
			 return
		 }
					var condition={"f_userid":userID,"f_imei":IMEI}
					var condition_up={"f_userid":userID,
					                  "f_imei":IMEI,
					                  "f_sessionid":sessionid,
					                  "f_socketid":socketid,
					                  "f_username":username,
					                  "f_picture":picture,
					                  "f_newname":userID,
					                  "f_wx_openid":wx_openid,       //微信openid
					                  "f_newpicture":f_newpicture,  //写死的默认头像
					                  "f_status":"1",
					                  "f_updatetime":datetime};
					
	 mongodbUtil.commonSelect(DB_CONN_STR, "t_user_login_status", condition, function(state, error, result) {		 				
	  		if(state== "0"){//数据库操作正常
	  			if(result != null &&result.length>0){//有这条记录则进行状态更新,status: 1为在线，0为下线
	  			var wxopenid=result[0].f_wx_openid;
	  			if(wx_openid.length==0){
		  			wx_openid=wxopenid;
	  			}
	  			var updateData={"f_userid":userID,
					                  "f_imei":IMEI,
					                  "f_sessionid":sessionid,
					                  "f_socketid":socketid,
					                  "f_username":username,
					                  "f_picture":picture,
					                  "f_newname":userID,
					                  "f_wx_openid":wx_openid,       //微信openid
					                  "f_newpicture":f_newpicture,  //写死的默认头像
					                  "f_status":"1",
					                  "f_updatetime":datetime};
				mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_login_status", condition,updateData, function(state1, error1, result1) {
						if(state1=="0"){
							mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_user_bind",condition,function(state4,error4,result4){
								if(state=="0"){
										if(result4!=null &&result4.length>0){
												var mac=result4[0].f_mac;
												returnInfo = { "state": "1", "mac":mac,"message": "已绑定用户上线!","f_newname":userID,"f_newpicture":f_newpicture};
                								res.send(returnInfo);									
										}else{
												returnInfo = { "state": "1", "mac":"","message": "未绑定用户上线!","f_newname":userID,"f_newpicture":f_newpicture };
                								res.send(returnInfo);					
										}			
								}else{
									returnInfo = { "state": "-1", "errorid":"004","message": error4 };
                					res.send(returnInfo);
								}
							})
							//var info={"f_userid":userID,"f_imei":IMEI,"f_status":"1"}
							//returnInfo={"state":"1","message":"用户上线!","data":condition_up}
							//res.send(returnInfo);								
						}else{
							returnInfo = { "state": "-1", "errorid":"001","message": error1 };
                			res.send(returnInfo);				
						}															
					})					  		
		  		}else{//没有这条记录则进行插入
		  		    //var condition1={"f_userid":userID,"f_imei":IMEI,"f_status":"1"}
					mongodbUtil.commonInsert(DB_CONN_STR, "t_user_login_status", condition_up, function(state2, error2, result2){
						if(state2 == "0"){
							mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_user_bind",condition,function(state4,error4,result4){
								if(state=="0"){
										if(result4!=null &&result4.length>0){
												var mac=result4[0].f_mac;
												returnInfo = { "state": "1", "mac":mac,"message": "已绑定用户上线!","f_newname":userID,"f_newpicture":f_newpicture};
                								res.send(returnInfo);									
										}else{
												returnInfo = { "state": "1", "mac":"","message": "未绑定用户上线!","f_newname":userID,"f_newpicture":f_newpicture};
                								res.send(returnInfo);					
										}			
								}else{
									returnInfo = { "state": "-1", "errorid":"005","message": error4 };
                					res.send(returnInfo);
								}
							})
							//var info={"f_userid":userID,"f_imei":IMEI,"f_status":"1"};
							//returnInfo={"state":"1","message":"用户上线!","data":info}
							//res.send(returnInfo);										
						}else{
							returnInfo = { "state": "-1", "errorid":"002","message": error2 };
                			res.send(returnInfo);									
						}											
					})						
			  	}					
		  	}else{
				returnInfo = { "state": "-1", "errorid":"003","message": error };
                res.send(returnInfo);						
			}	
	})
})



/*用户登陆下线接口
参数：userID=xxx&userPWD=xxx&IMEI=xxx
返回：用户信息
*/
app.get('/user/offline',function(req,res){
	res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
		 var userID = req["query"]["userID"] || ''
		 var IMEI = req["query"]["IMEI"] || ''
		 var userPWD = req["query"]["userPWD"] || '1'
		 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");
		 if(userID.length<=0 || IMEI.length<=0 || userPWD.length<=0){
			 returnInfo={"state":"-1","message":"参数错误！"}
			 res.send(returnInfo);
			 return
		 }
		 var condition={"f_userid":userID,"f_imei":IMEI}
		 var condition_up={"f_userid":userID,"f_imei":IMEI,"f_status":"0","f_updatetime":datetime}
	 mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",condition,function(state,error,result){
			if(state=="0"){
					if(result != null &&result.length>0){
						var _id=result[0]._id;
						var updateData=result[0];
						updateData["f_status"]="0";
						updateData["f_updatetime"]=datetime;
						updateData["f_sessionid"]="";
						updateData["f_socketid"]="";
						console.log(updateData);
						mongodbUtil.commonUpdate(DB_CONN_STR,"t_user_login_status",{"_id":_id},updateData,function(state1,error1,result1){
							if(state1=="0"){
								returnInfo={"state":"1","message":"用户下线！","data":updateData}
								res.send(returnInfo)											
							}else{
								returnInfo = { "state": "-1", "errorid":"001","message": error1 };
                				res.send(returnInfo);			
							}									
						})										
					}else{
						returnInfo = { "state": "1","message": "无此用户登陆信息！" };
                		res.send(returnInfo);								
					}						
				}else{
					returnInfo = { "state": "-1", "errorid":"001","message": error };
                	res.send(returnInfo);							
				}											
	})
})






/*终端登陆上线接口
参数：mac=xxxx&socketid=xxx
返回：绑定信息
*/
app.get('/ott/online',function(req,res){
	res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
		 var mac = req["query"]["mac"] || ''
		 var socketid = req["query"]["socketid"] || ''
		 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");		
		 if(mac.length<=0 ||socketid.length<=0){
			 returnInfo={"state":"-1","message":"参数错误！"}
			 res.send(returnInfo);
			 return
		 }
		 var condition={"f_mac":mac}
		 var condition_up={"f_mac":mac,"f_status":"1","f_socketid":socketid,"f_updatetime":datetime}	 					
	 mongodbUtil.commonSelect(DB_CONN_STR, "t_ott_user_bind", condition, function(state, error, result) {				
	  		if(state== "0"){//数据库操作正常,得到绑定列表,修改状态为上线	  								
				mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_status",condition,function(state1,error1,result1){
				//console.log("zzzzzzzzzzzzzzzzzzx" + result1 + result1.length);	
				if(state1=="0")	{
					if(result1 != null && result1.length>0){//存在，直接修改状态
							mongodbUtil.commonUpdate(DB_CONN_STR,"t_ott_status",condition,condition_up,function(state2,error2,result2){
								if(state2=="0"){
									if(result!=null && result.length>0){
									var info=new Array()
									var endflag=0
									result.map((issue)=>{
									var tmp=JSON.stringify(issue)
										tmp=JSON.parse(tmp);
										var userID=tmp.f_userid
										var imei=tmp.f_imei
										var condition={"f_userid":userID,"f_imei":imei}
								mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",condition,function(state4,error4,result4){
											info.push(result4[0]);
											
											endflag=endflag+1
											//console.log(info);
											if(endflag==result.length){
											returnInfo={"state":"1","message":"有绑定用户的终端上线成功！","data":info}
											res.send(returnInfo)
											}
											//endflag=endflag+1				
										})
									})
								}else{
									returnInfo={"state":"1","message":"无绑定用户的终端上线成功！","data":""}
									res.send(returnInfo)
								}																																		
							}else{
									returnInfo={"state":"-1","errorid":"001","message":error2}
									res.send(returnInfo)												
								}														
							})																		
						}else{//不存在则插入一条
							//var condition1={"f_mac":mac,"f_status":"1"}		
							mongodbUtil.commonInsert(DB_CONN_STR,"t_ott_status",condition_up,function(state3,error3,result3){
								if(state3=="0"){
									var info=new Array()
									var endflag=0
									result.map((issue)=>{
									var tmp=JSON.stringify(issue)
										tmp=JSON.parse(tmp);
										var userID=tmp.f_userid
										var imei=tmp.f_imei
										var condition={"f_userid":userID,"f_imei":imei}
								mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",condition,function(state4,error4,result4){
											info.push(result4[0]);
											endflag=endflag+1
											//console.log(info);
											if(endflag==result.length){
											returnInfo={"state":"1","message":"上线成功！","data":info}
											res.send(returnInfo)
											}
											//endflag=endflag+1				
										})
									})														

									
																	
								}else{
									returnInfo={"state":"-1","errorid":"002","message":error3}
									res.send(returnInfo)							
								}																												
							})												
																	
						}
					}else{
						returnInfo={"state":"-1","errorid":"003","message":error1}
						res.send(returnInfo)			
					}													

				})			  		 		    									
		  	}else{
				returnInfo = { "state": "-1", "errorid":"004","message": error };
                res.send(returnInfo);						
			}	
	})
})



/*终端登陆下线接口
参数：mac=xxx
返回：终端状态信息
*/
app.get('/ott/offline',function(req,res){
	res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
		 var mac = req["query"]["mac"] || ''
		 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");		 
		 if(mac.length<=0){
			 returnInfo={"state":"-1","message":"参数错误！"}
			 res.send(returnInfo);
			 return
		 }
		 var condition={"f_mac":mac}
		 var condition_up={"f_mac":mac,"f_status":"0","f_updatetime":datetime}
	 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_status",condition,function(state1,error1,result1){
			if(state1=="0"){
				if(result1!=null && result1.length>0){
				  mongodbUtil.commonUpdate(DB_CONN_STR, "t_ott_status", condition,condition_up,function(state, error, result) {			
	  				if(state== "0"){//数据库操作正常	 						
					    returnInfo={"state":"1","message":"终端下线！","data":condition_up}							
					    res.send(returnInfo)			 											  							
		  	}else{
				returnInfo = { "state": "-1", "errorid":"001","message": error };
                res.send(returnInfo);						
			}	
	     })				
	   }else{
			returnInfo={"state":"1","message":"无此终端登陆信息！"}
			res.send(returnInfo)			
		 }			
	}else{
		returnInfo = { "state": "-1", "errorid":"002","message": error1 };
        res.send(returnInfo);				
	}		
  })			 
})



/*绑定
参数：userID=xxx&IMEI=xxx&mac=xxx
返回值：绑定成功
*/
app.get('/ottuser/bind',function(req,res){
	 res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
	 var userID = req["query"]["userID"] || ''
	 var IMEI = req["query"]["IMEI"] || ''
	 var mac = req["query"]["mac"] || ''
	 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");
	 
	 if(userID.length<=0 || IMEI.length<=0 || mac.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_userid":userID,"f_imei":IMEI,"f_mac":mac}
	 var condition_up={"f_userid":userID,"f_imei":IMEI,"f_mac":mac,"f_updatetime":datetime}
	mongodbUtil.commonSelect(DB_CONN_STR, "t_ott_user_bind", condition, function(state, error, result) {				
	  		if(state== "0"){//数据库操作正常
	  			if(result != null &&result.length>0){//有这条记录则提示重复绑定
					returnInfo={"state":"1","message":"此用户已经绑定了该终端！","data":condition}
					res.send(returnInfo)									  		
		  		}else{//没有这条记录则进行插入		  		    
					mongodbUtil.commonInsert(DB_CONN_STR, "t_ott_user_bind", condition_up, function(state1, error1, result1){
						if(state1 == "0"){
							
						mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_status",{"f_mac":mac},function(state2,error2,result2){
							if(state2=="0"){
								if(result2!=null &&result2.length>0){
									status=result2[0].f_status;
									if(status=="1"){ //在线终端进行通知
										socketid=result2[0].f_socketid;
										if(socketid!=null && socketid.length>0){
											   var condition_upp={"f_imei":IMEI,"f_userid":userID};
											   console.log(IMEI+":"+userID);
									mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",condition_upp,function(state3,error3,result3){
														if(state3=="0"){
															console.log(result3);
															if(result3!=null &&result3.length>0){
																var publishdata={"socketid":socketid,"data":JSON.stringify(result3[0])};	
																		 console.log(JSON.stringify(publishdata))			
																		 var client = redis.createClient(6379, "www.go3c.tv");
																		 client.auth('go3credis',function(){
																      			console.log("redis通过认证！！")
															      			});
															      		 client.on("error",function(err){  
															                   console.log("err"+err);  
															                }); 
															             client.on('ready',function(){  
															                client.publish('OTT_USERBIND',JSON.stringify(publishdata));              
															                client.end(true);
															      returnInfo={"state":"1","message":"绑定成功，通知终端成功！","data":result2[0]}
															      res.send(returnInfo);     
															        });											
															}else{
																returnInfo={"state": "0","message":"绑定成功，没有用户信息！"}
																res.send(returnInfo);													
															}				
														}else{
															returnInfo = { "state": "-1", "errorid":"004","message": error3 };
                											res.send(returnInfo);					
														}					
												   }) 
									    }else{
										    returnInfo={"state": "0","message":"绑定成功，长连接不存在！","data":result2[0]}
											res.send(returnInfo)
									    }
									}else{//终端不在线时忽略
										returnInfo={"state": "0","message":"绑定成功，终端没有上线！","data":result2[0]}
										res.send(returnInfo)
									}
															
													
								}else{
									returnInfo={"state": "0","message":"绑定成功，没有终端记录！","data":result2[0]}
									res.send(returnInfo)
								}
																
							}else{
								returnInfo={"state": "-1", "errorid":"003","message": error2}
								res.send(returnInfo)
							}												

						})						
															
						}else{
							returnInfo = { "state": "-1", "errorid":"001","message": error2 };
                			res.send(returnInfo);									
					  }											
					})						
			  	}					
		  	}else{
				returnInfo = { "state": "-1", "errorid":"002","message": error };
                res.send(returnInfo);						
			}	
	})	
 
	
});

/*手机端绑定信息管理
参数：userID=xxx&IMEI=xxx
返回值：绑定的mac地址数组
*/
app.get('/ottuser/bindInfo',function(req,res){
	 res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
	 var userID = req["query"]["userID"] || ''
	 var IMEI = req["query"]["IMEI"] || ''
	 if(userID.length<=0 || IMEI.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！请求失败"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_userid":userID,"f_imei":IMEI};
	 mongodbUtil.commonSelect(DB_CONN_STR, "t_ott_user_bind", condition, function(state, error, result) {				
	  		if(state== "0"){//数据库操作正常
	  			if(result != null &&result.length>0){//有这条记录则返回相应mac地址
					var endflag=0;
	                var info=new Array();
					result.map((issue)=>{
						var f_mac=issue.f_mac;
						var condition_up={"f_mac":f_mac};
						mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_status",condition_up,function(state2,error2,result2){
							if(state2=="0"){
									if(result2 != null &&result2.length>0){
										info.push(result2[0]);
										endflag=endflag+1;
										if(endflag==result.length){
											//console.log(info);
											returnInfo={"state":"1","message":"获取绑定信息成功！","data":info}
											res.send(returnInfo)
											}			
									}else{
										returnInfo = { "state": "1","message":"没有终端信息！","data":""};
                						res.send(returnInfo);				
									}				
								
							}else{
								returnInfo = { "state": "-1", "errorid":"002","message": error2 };
                				res.send(returnInfo);
							}											
						})																																    	})		
		  		}else{//没有这条记录则返回状态码为0，mac为空		  		    
					returnInfo = { "state": "1","message":"此用户无绑定记录！","data":""};
                	res.send(returnInfo);					
			  }					
		  	}else{
				returnInfo = { "state": "-1", "errorid":"001","message": error };
                res.send(returnInfo);						
		 }	
	})
	
})


/*终端绑定信息管理
参数：mac=xxx
返回值：绑定的用户信息数组
*/
app.get('/ott/bindInfo',function(req,res){
	 res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });
	 var mac = req["query"]["mac"] || ''	 
	 if(mac.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！请求失败"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_mac":mac};
	 mongodbUtil.commonSelect(DB_CONN_STR, "t_ott_user_bind", condition, function(state, error, result) {				
	  		if(state== "0"){//数据库操作正常
	  			if(result != null &&result.length>0){//有这条记录则返回相应用户信息
					var endflag=0;
	                var info=new Array();
					result.map((issue)=>{
						var f_userid=issue.f_userid;
						var f_imei=issue.f_imei;
						var condition_up={"f_userid":f_userid,"f_imei":f_imei};
						mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",condition_up,function(state2,error2,result2){
							if(state2=="0"){
									if(result2 != null &&result2.length>0){
										info.push(result2[0]);
										endflag=endflag+1;
										if(endflag==result.length){
											//console.log(info);
											returnInfo={"state":"1","message":"获取绑定信息成功！","data":info}
											res.send(returnInfo)
											}			
									}else{
										returnInfo = { "state": "1","message":"没有用户信息！","data":""};
                						res.send(returnInfo);				
									}				
								
							}else{
								returnInfo = { "state": "-1", "errorid":"002","message": error2 };
                				res.send(returnInfo);
							}											
						})																																    	})		
		  		}else{//没有这条记录则返回状态码为0，mac为空		  		    
					returnInfo = { "state": "1","message":"此终端无绑定记录！","data":""};
                	res.send(returnInfo);					
			  }					
		  	}else{
				returnInfo = { "state": "-1", "errorid":"001","message": error };
                res.send(returnInfo);						
		 }	
	})
	
})




/*终端解除绑定
参数：&mac=xxx 
返回值：解除成功或者失败原因
*/
app.get('/ott/unbind',function(req,res){

	 //var IMEI = req["query"]["IMEI"] || ''
	 var mac = req["query"]["mac"] || ''
	 
	 if(mac.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_mac":mac}
     mongodbUtil.commonSelect(DB_CONN_STR, "t_ott_user_bind", condition, function(state, error, result) {
		if(state=="0"){
			if(result != null &&result.length>0){
				mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_user_bind",condition,function(state1,error1,result1){
					if(state1=="0"){
						returnInfo={"state":"1","message":"解除绑定成功！","mac":condition}
						res.send(returnInfo)						
					}else{
						returnInfo={"state": "-1", "errorid":"001","message": error1}
						res.send(returnInfo)									
					}												

				})											
			}else{
				returnInfo={"state":"1","message":"没有此绑定记录！","mac":""}
				res.send(returnInfo)							
			}										
		}else{
			returnInfo={"state": "-1", "errorid":"002","message": error}
			res.send(returnInfo)							
		}												

	}) 
	 								
	
})


/*手机端解除绑定
参数：IMEI=xxx&userID=xxx&mac=xxx
返回值：解除成功或者失败原因
*/
app.get('/user/unbind',function(req,res){
	 var IMEI = req["query"]["IMEI"] || ''
	 var userID = req["query"]["userID"] || ''
	 var mac = req["query"]["mac"] || ''
	 if(IMEI.length<=0 || userID.length<=0 ||mac.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_userid":userID,"f_imei":IMEI,"f_mac":mac}
     mongodbUtil.commonSelect(DB_CONN_STR, "t_ott_user_bind", condition, function(state, error, result) {
		if(state=="0"){
			if(result != null &&result.length>0){
				mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_user_bind",condition,function(state1,error1,result1){
					if(state1=="0"){
						mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_status",{"f_mac":mac},function(state2,error2,result2){
							if(state2=="0"){
								if(result2!=null &&result2.length>0){
									status=result2[0].f_status;
									if(status=="1"){ //在线终端进行通知
										socketid=result2[0].f_socketid;
										if(socketid!=null && socketid.length>0){
											 var condition_upp={"f_imei":IMEI,"f_userid":userID};
									mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",condition_upp,function(state3,error3,result3){
														if(state3=="0"){
															if(result3!=null &&result3.length>0){
																var publishdata={"socketid":socketid,"data":JSON.stringify(result3[0])};	
																		 console.log(JSON.stringify(publishdata))			
																		 var client = redis.createClient(6379, "www.go3c.tv");
																		 client.auth('go3credis',function(){
																      			console.log("redis通过认证！！")
															      			});
															      		 client.on("error",function(err){  
															                   console.log("err"+err);  
															                }); 
															             client.on('ready',function(){  
															                client.publish('OTT_USERUNBIND',JSON.stringify(publishdata));              
															                client.end(true);
															      returnInfo={"state":"1","message":"解绑成功，通知终端成功！","data":result2[0]}
															      res.send(returnInfo);     
															        });											
															}else{
																returnInfo={"state": "0","message":"解绑成功，没有用户信息！","data":result2[0]}
																res.send(returnInfo);													
															}				
														}else{
															returnInfo = { "state": "-1", "errorid":"004","message": error3 };
                											res.send(returnInfo);					
														}					
												   }) 								
											
											     
									    }else{
										    returnInfo={"state": "0","message":"解绑成功，长连接不存在！","data":result2[0]}
											res.send(returnInfo)
									    }
									}else{//终端不在线时忽略
										returnInfo={"state": "0","message":"解绑成功，终端没有上线！","data":result2[0]}
										res.send(returnInfo)
									}
															
													
								}else{
									returnInfo={"state": "0","message":"解绑成功，没有终端记录！","data":result2[0]}
									res.send(returnInfo)
								}
																
							}else{
								returnInfo={"state": "-1", "errorid":"003","message": error2}
								res.send(returnInfo)
							}												

						})						
						
						//returnInfo={"state":"1","message":"解除绑定成功！","data":condition}
						//res.send(returnInfo)						
					}else{
						returnInfo={"state": "-1", "errorid":"001","message": error1}
						res.send(returnInfo)									
					}												
				})											
			}else{
				returnInfo={"state":"0","message":"没有此绑定记录！"}
				res.send(returnInfo)							
			}										
		}else{
			returnInfo={"state": "-1", "errorid":"002","message": error}
			res.send(returnInfo)							
		}												
	}) 	 									
})


/*
终端长连接状态接口
参数：mac=xxx&socketid=xxx
返回值：成功/失败
*/
app.get('/ott/socketid',function(req,res){
	 var mac = req["query"]["mac"] || ''
	 var socketid = req["query"]["socketid"] || ''
	 if(mac.length<=0 || socketid.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }						
	var condition={"f_mac":mac}
	var condition_up={"f_mac":mac,"f_socketid":socketid,"f_status":"1"}
	 mongodbUtil.commonSelect(DB_CONN_STR, "t_ott_socketid_status", condition, function(state, error, result) {				
	  		if(state== "0"){//数据库操作正常
	  			if(result != null &&result.length>0){//有这条记录则进行socketid更新
				mongodbUtil.commonUpdate(DB_CONN_STR, "t_ott_socketid_status", condition,condition_up, function(state1, error1, result1) {
						if(state1=="0"){
							returnInfo={"state":"1","message":"保存成功!","data":result1}
							res.send(returnInfo);								
						}else{
							returnInfo = { "state": "-1", "errorid":"001","message": error1 };
                			res.send(returnInfo);				
						}															
					})					  		
		  		}else{//没有这条记录则进行插入		  		    
					mongodbUtil.commonInsert(DB_CONN_STR, "t_ott_socketid_status", condition_up, function(state2, error2, result2){
						if(state2 == "0"){
							returnInfo={"state":"1","message":"保存成功!","data":result2}
							res.send(returnInfo);										
						}else{
							returnInfo = { "state": "-1", "errorid":"002","message": error2 };
                			res.send(returnInfo);									
						}											
					})						
			  	}					
		  	}else{
				returnInfo = { "state": "-1", "errorid":"003","message": error };
                res.send(returnInfo);						
			}	
	})				
	
})


/*
手机端长连接状态接口
参数：userID=xxx&socketid=xxx
返回值：成功/失败
*/
app.get('/user/socketid',function(req,res){
	 var userID = req["query"]["userID"] || ''
	 var socketid = req["query"]["socketid"] || ''
	 if(userID.length<=0 || socketid.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }						
	var condition={"f_userid":userID}
	var condition_up={"f_userid":userID,"f_socketid":socketid,"f_status":"1"}
	 mongodbUtil.commonSelect(DB_CONN_STR, "t_user_socketid_status", condition, function(state, error, result) {				
	  		if(state== "0"){//数据库操作正常
	  			if(result != null &&result.length>0){//有这条记录则进行socketid更新
				mongodbUtil.commonUpdate(DB_CONN_STR, "t_user_socketid_status", condition,condition_up, function(state1, error1, result1) {
						if(state1=="0"){
							returnInfo={"state":"1","message":"保存成功!","data":result1}
							res.send(returnInfo);								
						}else{
							returnInfo = { "state": "-1", "errorid":"001","message": error1 };
                			res.send(returnInfo);				
						}															
					})					  		
		  		}else{//没有这条记录则进行插入
		  		    //var condition1={"f_userid":userID,"f_socketid":socketid}
					mongodbUtil.commonInsert(DB_CONN_STR, "t_user_socketid_status", condition_up, function(state2, error2, result2){
						if(state2 == "0"){
							returnInfo={"state":"1","message":"保存成功!","data":result2}
							res.send(returnInfo);										
						}else{
							returnInfo = { "state": "-1", "errorid":"002","message": error2 };
                			res.send(returnInfo);									
						}											
					})						
			  	}					
		  	}else{
				returnInfo = { "state": "-1", "errorid":"003","message": error };
                res.send(returnInfo);						
			}	
	})				
	
})


/*
小屏推大屏接口
参数：userID=xxx&mac=xxx&IMEI=xxx&data=xxx
返回值：成功/失败
*/
app.get('/ott/smallToBig',function(req,res){
	 var userID = req["query"]["userID"] || ''
	 var mac = req["query"]["mac"] || ''
	 var data = req["query"]["data"] || ''
	 var IMEI = req["query"]["IMEI"] || ''
	 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");
	 if(userID.length<=0 || mac.length<=0 ||data.length<=0 || IMEI.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_userid":userID,"f_mac":mac};	
	 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_user_bind",condition,function(state2,error2,result2){
                if(state2=="0"){
					if(result2!=null &&result2.length>0){//有绑定关系则进行推送
						mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_status",{"f_mac":mac},function(state,error,result){
		  if(state=="0"){
			if(result!=null &&result.length>0){//查找到相应的socketid进行redis发布
			 console.log(result[0].f_socketid)
			 var socketid=result[0].f_socketid ||''
			 if(socketid!=null && socketid.length>0){
			 var publishdata={"socketid":socketid,"data":data,"userID":userID};	
			 console.log(JSON.stringify(publishdata))			
			 var client = redis.createClient(6379, "www.go3c.tv");
			 client.auth('go3credis',function(){
	      			console.log("redis通过认证！！")
      			});
      		 client.on("error",function(err){  
                   console.log("err"+err);  
                }); 
             client.on('ready',function(){  
                client.publish('OTT_SMALLTOBIG',JSON.stringify(publishdata));              
                client.end(true);
             returnInfo={"state":"1","message":"推送成功！","data":condition}
             res.send(returnInfo);     
        });
       }else{
	       var condition_upp={"f_userid":userID,"f_mac":mac,"data":data,"f_updatetime":datetime};
			mongodbUtil.commonInsert(DB_CONN_STR,"t_ott_smalltobig_msg",condition_upp,function(state3,error3,result3){
				if(state3=="0"){
					returnInfo={"state":"1","message":"终端不在线，推送消息已缓存到数据库！！","data":condition}
		    		res.send(returnInfo);					
				}else{
					returnInfo={"state":"-1","errorid":"005","error":error}
		    		res.send(returnInfo);			
				}	

			})								        	        	     									  
       }
     }else{
			returnInfo={"state":"-1","message":"无此终端信息！"}
		    res.send(returnInfo);					
	    }   			   					
	   }else{
			returnInfo={"state":"-1","errorid":"001","error":error}
		    res.send(returnInfo);							
		}									     
   })			
}else{
	returnInfo={"state":"-1","message":"没有绑定记录！！"}
	res.send(returnInfo);					
}					
	                
                }else{
	               	returnInfo={"state":"-1","errorid":"006","error":error2}
		   		    res.send(returnInfo);			
                }
		 })		
     	
})


/*
不在线终端获取小屏推大屏消息接口：终端每次上线时或者打开推屏消息界面调用
参数:mac=xxx
返回值：推屏消息数组
*/
app.get('/ott/unTreatMsg',function(req,res){
      var mac = req["query"]["mac"] || ''
      if( mac.length<=0 ){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_smalltobig_msg",{"f_mac":mac},function(state,error,result){
	  if(state=="0"){//数据库操作正常
		if(result!=null &&result.length>0){		
						returnInfo={"state":"1","message":"获取消息成功！","data":result}
		 				res.send(returnInfo);								  
			}else{
				returnInfo={"state":"1","message":"没有未处理消息！","data":[]};
		 		res.send(returnInfo);		
			}		
		}else{
			 returnInfo={"state":"-1","errorid":"002","error":error}
		 	 res.send(returnInfo);				
		}					 
	 })

	
})




/*
删除多个小推大推屏消息
参数:mac=xxx&_id=a,b  //逗号隔开
返回值：推屏消息数组
*/
app.get('/ott/removeManyMsg',function(req,res){
       var mac = req["query"]["mac"] || ''
      //var IMEI = req["query"]["IMEI"] || ''
      var _id = req["query"]["_id"] || ''
      if( mac.length<=0  || _id.length<=0 ){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	
	 if (_id.indexOf(",") != -1){ //存在多个值
	    console.log("多值处理！");
		var _idarray=_id.split(",");
		var len=_idarray.length;
		var flag=0;
		//_idarray.forEach(function(v){
		//console.log(userID +"  "+ IMEI)
		mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_smalltobig_msg",{"f_mac":mac},function(state2,error2,result2){
			if(state2=="0"){				
				if(result2!=null &&result2.length>0){					
				    _idarray.forEach(function(v){					    	
						result2.map((issue)=>{
							var id=issue._id;														
							if(id==v){							   
								mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_smalltobig_msg",{"_id":id},function(state1,error,result1){
									if(state1=="0"){
										flag=flag+1;
										if(flag==len){
											returnInfo={"state":"1","message":"删除成功！"}
		 	            					res.send(returnInfo);				
										}			
									}else{
										returnInfo={"state":"-1","errorid":"001","error":error1}
		 	            				res.send(returnInfo);						
											
									}														

								})											
							}												
						})												
                    })
				}else{
					returnInfo={"state":"1","message":"没有该TV端消息"}
	 	            res.send(returnInfo);										
				}									

			}else{
				returnInfo={"state":"-1","errorid":"002","error":error2}
	 	        res.send(returnInfo);					
			}								
		})																												
	 }else{//数组只有一个值
	 console.log("单值处理");
		 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_smalltobig_msg",{"f_mac":mac},function(state,error,result){
	  if(state=="0"){//数据库操作正常
		if(result!=null &&result.length>0){
			result.map((issue)=>{
				var id=issue._id;
				//console.log(typeof(id)+"  "+typeof(_id));			
				if(id==_id){
						mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_smalltobig_msg",{"_id":id},function(state1,error1,result1){
						if(state=="0"){
								returnInfo={"state":"1","message":"消息删除成功！"};
				 				res.send(returnInfo);							
							}else{
						 		returnInfo={"state":"-1","errorid":"001","error":error1}
				 	 			res.send(returnInfo);
							}																	
					   })
				}else{
					console.log("!!!!!!!");				
				}				
				
			})			      		
		}else{
				returnInfo={"state":"1","message":"没有此TV端消息记录！"};
		 		res.send(returnInfo);		
			}		
		}else{
			 returnInfo={"state":"-1","errorid":"002","error":error}
		 	 res.send(returnInfo);				
		}					 
	 })

									

	 
	 }
	
})




/*
清空小推大推屏消息
参数:mac=xxx
返回值：推屏消息数组
*/
app.get('/ott/removeAllMsg',function(req,res){
      var mac = req["query"]["mac"] || ''
      //var IMEI = req["query"]["IMEI"] || ''
      //var _id = req["query"]["_id"] || ''
      if( mac.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_smalltobig_msg",{"f_mac":mac},function(state,error,result){
	  if(state=="0"){//数据库操作正常
									
			returnInfo={"state":"1","message":"消息已清空！"}
		 	res.send(returnInfo);					
				
		}else{
			 returnInfo={"state":"-1","errorid":"002","error":error}
		 	 res.send(returnInfo);				
		}					 
	 })

	
})
















/*
小屏推大屏状态上报
参数：userID=xxx&mac=xxx&data=xxx
返回值：成功/失败
*/
app.get('/ott/smallToBigStatus',function(req,res){
	 var userID = req["query"]["userID"] || ''
	 var mac = req["query"]["mac"] || ''
	  var data = req["query"]["data"] || ''
	 if(userID.length<=0 || mac.length<=0 ||data.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }			
     mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",{"f_userid":userID},function(state,error,result){
		if(state=="0"){//查找到相应的socketid进行redis发布
			 console.log(result[0].f_socketid)
			 var socketid=result[0].f_socketid
			 var publishdata={"socketid":socketid,"data":data};	
			 console.log(JSON.stringify(publishdata))			
			 var client = redis.createClient(6379, "www.go3c.tv");
			 client.auth('go3credis',function(){
	      			console.log("redis通过认证！！")
      			});
      		 client.on("error",function(err){  
                   console.log("err"+err);  
                }); 
             client.on('ready',function(){  
                client.publish('OTT_SMALLTOBIGSTATUS',JSON.stringify(publishdata));              
                client.end(true);
             returnInfo={"state":"1","message":"状态返回手机端！"}
             res.send(returnInfo);     
        });   			   					
	   }else{
			returnInfo={"state":"-1","errorid":"001","error":error}
		    res.send(returnInfo);							
		}									     
   })	
})



/*
手机端终端实时下线处理接口
参数：socketid=xxx
返回值：成功/失败
*/
app.get('/ott/realTimeOffline',function(req,res){
	var socketid = req["query"]["socketid"] || ''
	if(socketid.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");											
	mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",{"f_socketid":socketid},function(state,error,result){
		if(state=="0"){//数据库操作正常
			if(result!=null && result.length>0){//查询到数据则说明是手机端长连接断开
			    var updateData=result[0];
			    var _id=updateData["_id"];
			    updateData["f_status"]="0";
			    updateData["f_sessionid"]="";
			    updateData["f_socketid"]="";			   				
				mongodbUtil.commonUpdate(DB_CONN_STR,"t_user_login_status",{"_id":_id},updateData,function(state1,error1,result1){
					if(state1=="0"){
						returnInfo={"state":"1","message":"手机实时下线成功！"}
						res.send(returnInfo)									
					}else{
						returnInfo={"state":"-1","errorid":"001","error":error1}
		    			res.send(returnInfo);									
					}								
				})																
			}else{//查询不到数据则说明是tv端异常下线
				mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_status",{"f_socketid":socketid},function(state2,error2,result2){
					if(state2=="0"){
						if(result2!=null &&result2.length>0){//查询到了数据则说明是tv端长连接断开
							var mac=result2[0].f_mac;
							var condition={"f_mac":mac};
							var condition_up={"f_mac":mac,"f_status":"0","f_updatetime":datetime.toLocaleString()}
							mongodbUtil.commonUpdate(DB_CONN_STR,"t_ott_status",condition,condition_up,function(state3,error3,result3){
								if(state3=="0"){
									returnInfo={"state":"1","message":"终端实时下线成功！"}
									res.send(returnInfo)		
								}else{
									returnInfo={"state":"-1","errorid":"002","error":error3}
		    						res.send(returnInfo);			
								}									
							})									
						}else{
							returnInfo={"state":"-1","message":"无效的socketid!"}
		    				res.send(returnInfo);							
						}						
					}else{
						returnInfo={"state":"-1","errorid":"003","error":error2}
		    			res.send(returnInfo);							
					}											
				})					
			}							
		}else{
			returnInfo={"state":"-1","errorid":"004","error":error}
		    res.send(returnInfo);							
		}																									
	})													
})



/*
大屏推小屏接口初始
参数：userID=xxx&IMEI=xxx&mac=xxx&data=xxx
返回值：成功/失败
*/
/*app.get('/ott/bigToSmall',function(req,res){
	 var userID = req["query"]["userID"] || ''
	 var mac = req["query"]["mac"] || ''
	 var data = req["query"]["data"] || ''
	 var imei = req["query"]["IMEI"] || '' 
	 if(userID.length<=0 || mac.length<=0 ||data.length<=0 ||imei.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }	
	 var condition={"f_userid":userID,"f_mac":mac};		
     mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",{"f_userid":userID,"f_imei":imei},function(state,error,result){
		if(state=="0"){
			if(result!=null &&result.length>0){//查找到相应的socketid进行redis发布
			 console.log(result[0].f_socketid)
			 var socketid=result[0].f_socketid ||''
			 if(socketid!=null &&socketid.length>0){
			 var publishdata={"socketid":socketid,"data":data,"mac":mac};	
			 console.log(JSON.stringify(publishdata))			
			 var client = redis.createClient(6379, "www.go3c.tv");
			 client.auth('go3credis',function(){
	      			console.log("redis通过认证！！")
      			});
      		 client.on("error",function(err){  
                   console.log("err"+err);  
                }); 
             client.on('ready',function(){  
                client.publish('OTT_SMALLTOBIG',JSON.stringify(publishdata));              
                client.end(true);
             returnInfo={"state":"1","message":"推送成功！","data":condition}
             res.send(returnInfo);     
        });
      }else{
	      	returnInfo={"state":"-1","message":"无此用户长连接信息！"}
		    res.send(returnInfo);									
      }
    }else{
			returnInfo={"state":"-1","message":"无此用户信息！"}
		    res.send(returnInfo);							
	   }   			   					
   }else{
		returnInfo={"state":"-1","errorid":"001","error":error}
	    res.send(returnInfo);							
	}									     
  })	
})*/


/*
大屏推小屏接口
参数：userID=xxx&mac=xxx&IMEI=xxx&data=xxx
返回值：成功/失败
*/
app.get('/ott/bigToSmall',function(req,res){
	//console.log("bigToSmall!");
	 var userID = req["query"]["userID"] || ''
	 var mac = req["query"]["mac"] || ''
	 var data = req["query"]["data"] || ''
	 var IMEI = req["query"]["IMEI"] || ''
	 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");
	 if(userID.length<=0 || mac.length<=0 ||data.length<=0 || IMEI.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_userid":userID,"f_mac":mac};	
	 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_user_bind",condition,function(state2,error2,result2){
                if(state2=="0"){
					if(result2!=null &&result2.length>0){//有绑定关系则进行推送
					mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",{"f_userid":userID,"f_imei":IMEI},function(state,error,result){
		  if(state=="0"){
			if(result!=null &&result.length>0){//查找到相应的socketid进行redis发布
			    //console.log("data"+JSON.parse(data));
			    data=JSON.parse(data);
			    var colid=data.colid;
			    var playTime=data.playtime;
			    data.f_datetime=datetime||'';
			 	var vid=data.videoid;
			 	var videonumber1=vid.split(".")[1]||'';
			 	var url="http://www.go3c.tv:8030/backend/mobileott/api/php/php_video.php?vid="+vid;
			 	if(videonumber1.length>0){
				 	var videonumber="第"+videonumber1+"集";
				 	request({
								    url: url,
								    method: "GET",
								    json: true,
								    headers: {
								    "content-type": "application/json",
								    }}, function(error, response, body) {
								    if (!error && response.statusCode == 200) {
									    var iimage=response.body.images;
									    var nname=response.body.name;
									    //console.log("图片"+iimage);
									    data.videoimg=iimage;
									    data.videoname=nname;
									    data.videonumber=videonumber;
									    data=JSON.stringify(data);									    
									    var socketid=result[0].f_socketid ||''
										 if(socketid!=null && socketid.length>0){//手机端在线时即时推送
										 var publishdata={"socketid":socketid,"data":data,"mac":mac};	
										 //console.log(JSON.stringify(publishdata))			
										 var client = redis.createClient(6379, "www.go3c.tv");
										 client.auth('go3credis',function(){
								      			console.log("redis通过认证！！")
							      			});
							      		 client.on("error",function(err){  
							                   console.log("err"+err);  
							                }); 
							             client.on('ready',function(){  
							                client.publish('OTT_BIGTOSMALL',JSON.stringify(publishdata));              
							                client.end(true);
							             returnInfo={"state":"1","message":"推送成功！","data":condition}
							             res.send(returnInfo);     
							        });
							       }else{
								       var condition_upp={"f_userid":userID,"f_imei":IMEI,"f_mac":mac,"data":data,"f_updatetime":datetime};
										mongodbUtil.commonInsert(DB_CONN_STR,"t_ott_bigtosmall_msg",condition_upp,function(state3,error3,result3){
											if(state3=="0"){//手机端不在线时保存一条消息，并且推送微信模板消息
													mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",{"f_userid":userID,"f_imei":IMEI},function(state9,error9,result9){
													if(state9=="0"){
															if(result9!=null&&result9.length>0){																	
																    mongodbUtil.commonSelect(DB_CONN_STR,"t_access_token",{},function(state10,error10,result10){
																		if(state10=="0"){
																			    if(result10!=null&&result10.length>0){
																						var wx_openid=result9[0].f_wx_openid;
																						var keyword1="视频名称："+nname;
																						var keyword2="推送时间："+datetime;
																						//console.log("栏目："+colid);
																						var wx_playurl="http://www.go3c.tv/#/";
																						if(colid=="3"){//综艺
																							wx_playurl=wx_playurl+"varietyplaymessage?vid="+vid+"&playTime="+playTime+"&num="+videonumber1;
																							//console.log("综艺："+wx_playurl);
																							};
																						if(colid=="4"){//电视剧
																							wx_playurl=wx_playurl+"teleplaymessage?vid="+vid+"&playTime="+playTime+"&num="+videonumber1;
																							//console.log("电视剧："+wx_playurl);
																							};
																						if(colid=="5"){//电影
																							wx_playurl=wx_playurl+"moviemessageplay?vid="+vid+"&playTime="+playTime;
																							//console.log("电影："+wx_playurl)
																							};						
																						//console.log("外面："+wx_playurl);
																						var wxdata={
																					           "touser":wx_openid,
																					           "template_id":"lerJbX-NCT0q8uZ6lZ8_to73URbZKuieJveETBqKQ3w",
																					           "url":wx_playurl,                           
																					           "data":{
																					                   "first": {
																					                       "value":"大屏推小屏成功！",
																					                       "color":"#2b4490"
																					                   },
																					                   "keyword1":{
																					                       "value":keyword1,
																					                       "color":"#2b4490"
																					                   },
																					                   "keyword2": {
																					                       "value":keyword2,
																					                       "color":"#2b4490"
																					                   },
																					                   "remark":{
																					                       "value":"【点击进行播放！】",
																					                       "color":"#2b4490"
																					                   }
																					           }
																					       };
																					     var access_token=result10[0].access_token;
																					     var wxurl="https://api.weixin.qq.com/cgi-bin/message/template/send?access_token="+access_token;
																					     request({
																							    url: wxurl,
																							    method: "POST",
																							    json: true,
																							    headers: {
																							    "content-type": "application/json",
																							    },body: wxdata}, function(error, response, body) {
																							    if (!error && response.statusCode == 200) {
																								    console.log(response.body)
																								    returnInfo={"state":"1","message":"发送模板消息成功","data":response.body};
									    															res.send(returnInfo);
																							    }else{
																									returnInfo={"state":"-1","message":"发送模板消息失败"}
									    															res.send(returnInfo);								
																								    
																							    }
																							});
																																												      										

																				}else{																												
																				returnInfo={"state":"-1","message":"获取access_token失败"}
									    										res.send(returnInfo);
																				}															
																		}else{
																			returnInfo={"state":"-1","errorid":"010","error":error10}
									    									res.send(returnInfo);											
																		}												

																	})   															

															}else{
																returnInfo={"state":"-1","message":"无此用户数据"}
									    						res.send(returnInfo);		
																							
															}										
													}else{
														returnInfo={"state":"-1","errorid":"009","error":error9}
									    				res.send(returnInfo);						
													}																										

												})									
												
												//returnInfo={"state":"1","message":"手机端端不在线，推送消息已缓存到数据库！！","data":condition}
									    		//res.send(returnInfo);					
											}else{
												returnInfo={"state":"-1","errorid":"005","error":error}
									    		res.send(returnInfo);			
											}	

										})								        	        	     									  
							       }
									   
								    }else{
									    returnInfo = { "state": "-1", "message": "内部获取数据出错！"};
                    					res.send(returnInfo);
								    }
								})		 
			
			 	}else{
				 	request({
								    url: url,
								    method: "GET",
								    json: true,
								    headers: {
								    "content-type": "application/json",
								    }}, function(error, response, body) {
								    if (!error && response.statusCode == 200) {
									    var iimage=response.body.images;
									    var nname=response.body.name;
									    //console.log("图片"+iimage);
									    data.videoimg=iimage;
									    data.videoname=nname;
									    data.videonumber=videonumber1;
									    data=JSON.stringify(data);									    
									    var socketid=result[0].f_socketid ||''
										 if(socketid!=null && socketid.length>0){//手机端在线时即时推送
										 var publishdata={"socketid":socketid,"data":data,"mac":mac};	
										 //console.log(JSON.stringify(publishdata))			
										 var client = redis.createClient(6379, "www.go3c.tv");
										 client.auth('go3credis',function(){
								      			console.log("redis通过认证！！")
							      			});
							      		 client.on("error",function(err){  
							                   console.log("err"+err);  
							                }); 
							             client.on('ready',function(){  
							                client.publish('OTT_BIGTOSMALL',JSON.stringify(publishdata));              
							                client.end(true);
							             returnInfo={"state":"1","message":"推送成功！","data":condition}
							             res.send(returnInfo);     
							        });
							       }else{
								       var condition_upp={"f_userid":userID,"f_imei":IMEI,"f_mac":mac,"data":data,"f_updatetime":datetime};
										mongodbUtil.commonInsert(DB_CONN_STR,"t_ott_bigtosmall_msg",condition_upp,function(state3,error3,result3){
											if(state3=="0"){
													mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",{"f_userid":userID,"f_imei":IMEI},function(state9,error9,result9){
													if(state9=="0"){
															if(result9!=null&&result9.length>0){																	
																    mongodbUtil.commonSelect(DB_CONN_STR,"t_access_token",{},function(state10,error10,result10){
																		if(state10=="0"){
																			    if(result10!=null&&result10.length>0){
																						var wx_openid=result9[0].f_wx_openid;
																						var keyword1="视频名称："+nname;
																						var keyword2="推送时间："+datetime;
																						var wx_playurl="http://www.go3c.tv/#/";
																						if(colid=="3"){//综艺
																							wx_playurl=wx_playurl+"varietyplaymessage?vid="+vid+"&playTime="+playTime+"&num="+videonumber1																											
																							};
																						if(colid=="4"){//电视剧
																							wx_playurl=wx_playurl+"teleplaymessage?vid="+vid+"&playTime="+playTime+"&num="+videonumber1;																				
																							};
																						if(colid=="5"){//电影
																							wx_playurl=wx_playurl+"moviemessageplay?vid="+vid+"&playTime="+playTime;
																							};		
																						var wxdata={
																					           "touser":wx_openid,
																					           "template_id":"lerJbX-NCT0q8uZ6lZ8_to73URbZKuieJveETBqKQ3w",
																					           "url":wx_playurl,                           
																					           "data":{
																					                   "first": {
																					                       "value":"大屏推小屏成功！",
																					                       "color":"#2b4490"
																					                   },
																					                   "keyword1":{
																					                       "value":keyword1,
																					                       "color":"#2b4490"
																					                   },
																					                   "keyword2": {
																					                       "value":keyword2,
																					                       "color":"#2b4490"
																					                   },
																					                   "remark":{
																					                       "value":"【点击进行播放！】",
																					                       "color":"#2b4490"
																					                   }
																					           }
																					       };
																					     var access_token=result10[0].access_token;
																					     var wxurl="https://api.weixin.qq.com/cgi-bin/message/template/send?access_token="+access_token;
																					     request({
																							    url: wxurl,
																							    method: "POST",
																							    json: true,
																							    headers: {
																							    "content-type": "application/json",
																							    },body: wxdata}, function(error, response, body) {
																							    if (!error && response.statusCode == 200) {
																								    console.log(response.body)
																								    returnInfo={"state":"1","message":"发送模板消息成功","data":response.body};
									    															res.send(returnInfo);
																							    }else{
																									returnInfo={"state":"-1","message":"发送模板消息失败"}
									    															res.send(returnInfo);								
																								    
																							    }
																							});
																																												      										

																				}else{																												
																				returnInfo={"state":"-1","message":"获取access_token失败"}
									    										res.send(returnInfo);
																				}															
																		}else{
																			returnInfo={"state":"-1","errorid":"010","error":error10}
									    									res.send(returnInfo);											
																		}												

																	})   															

															}else{
																returnInfo={"state":"-1","message":"无此用户数据"}
									    						res.send(returnInfo);		
																							
															}										
													}else{
														returnInfo={"state":"-1","errorid":"009","error":error9}
									    				res.send(returnInfo);						
													}																										

												})									
												
												//returnInfo={"state":"1","message":"手机端端不在线，推送消息已缓存到数据库！！","data":condition}
									    		//res.send(returnInfo);							

												
												//returnInfo={"state":"1","message":"手机端端不在线，推送消息已缓存到数据库！！","data":condition}
									    		//res.send(returnInfo);					
											}else{
												returnInfo={"state":"-1","errorid":"005","error":error}
									    		res.send(returnInfo);			
											}	

										})								        	        	     									  
							       }
									   
								    }else{
									    returnInfo = { "state": "-1", "message": "内部获取数据出错！"};
                    					res.send(returnInfo);
								    }
								})		 
			
			 	}
			 	//videonumber="第"+videonumber+"集";			 
			 	//console.log(data.videoid);
				//var url="http://www.go3c.tv:8030/backend/mobileott/api/php/php_video.php?vid="+vid;		
			 	//console.log(url);
			 	
     }else{
			returnInfo={"state":"-1","message":"无此终端信息！"}
		    res.send(returnInfo);					
	    }   			   					
	   }else{
			returnInfo={"state":"-1","errorid":"001","error":error}
		    res.send(returnInfo);							
		}									     
   })			
}else{
	returnInfo={"state":"-1","message":"没有绑定记录！！"}
	res.send(returnInfo);					
}					
	                
                }else{
	               	returnInfo={"state":"-1","errorid":"006","error":error2}
		   		    res.send(returnInfo);			
                }
		 })		
     	
})



/*
不在线手机端获取大屏推小屏消息接口：手机端每次上线时或者打开推屏消息界面调用
参数:userID=xxx&IMEI=xxx
返回值：推屏消息数组
*/
app.get('/user/unTreatMsg',function(req,res){
      var userID = req["query"]["userID"] || ''
      var IMEI = req["query"]["IMEI"] || ''
      if( IMEI.length<=0 || userID.length<=0 ){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_bigtosmall_msg",{"f_userid":userID,"f_imei":IMEI},function(state,error,result){
	  if(state=="0"){//数据库操作正常
		if(result!=null &&result.length>0){
			      		returnInfo={"state":"1","message":"获取消息成功！","data":result}
		 				res.send(returnInfo);
			}else{
				returnInfo={"state":"1","message":"没有未处理消息！","data":[]};
		 		res.send(returnInfo);		
			}		
		}else{
			 returnInfo={"state":"-1","errorid":"002","error":error}
		 	 res.send(returnInfo);				
		}					 
	 })

	
})




/*
用户注册接口
参数：phoneNumber(手机号)、password(密码)、//verifyCode(验证码)、phoneInfo(设备信息)
返回值：state: 1成功 -1失败	
       message:响应描述       
*/
app.get('/ottuser/register',function(req,res){
var phoneNumber = req["query"]["phoneNumber"] || ''
  var password = req["query"]["password"] || ''
   var verifyCode = req["query"]["verifyCode"] || ''
    var phoneInfo = req["query"]["phoneInfo"] || ''
    if(phoneNumber.length<=0 || password.length<=0 ||verifyCode.length<=0 ||phoneInfo.length<=0){
	    returnInfo={"state":"-1","message":"参数错误！"}
		res.send(returnInfo);
		return
    }
    var time=getCurTime("yyyy-MM-dd hh:mm:ss")
    var condition_up={"f_phonenumber":phoneNumber,"f_password":password,"f_phoneinfo":phoneInfo}
    var condition={"f_phonenumber":phoneNumber}
    mongodbUtil.commonSelect(DB_CONN_STR,"t_ottuser_register",condition,function(state,error,result){
	    if(state=="0"){
		    if(result!=null && result.length>0){//查询到结果说明已经注册过
			    returnInfo={"state":"-1","message":"该用户已经注册过！"}
			    res.send(returnInfo)
		    }else{
			    mongodbUtil.commonInsert(DB_CONN_STR,"t_ottuser_register",condition_up,function(state1,error1,result1){
				    if(state1=="0"){
					    returnInfo={"state":"1","message":"注册成功！"}
			    		res.send(returnInfo)
				    }else{
					    returnInfo={"state":"-1","errorid":"001","message":error1};
						res.send(returnInfo);
				    }
			    })
		    }
	    }else{
		    returnInfo={"state":"-1","errorid":"002","message":error};
			res.send(returnInfo);
	    }
    })
	
})



/*
手机端获取终端点播播放记录接口
参数：termid=3&openid=xxxx   3:终端类型号  4:手机端类型号
返回值：终端播放信息数组
*/
app.get('/user/getVodHistory',function(req,res){
    res.set({ 'Content-Type': 'text/json', 'Encodeing': 'utf8' });

    var userID = req["query"]["openid"]; //userID和openid一致 xiaoliu add 2017-4-8
    var termid = req["query"]["termid"];
    var returnInfo;
    // console.log(userID);
    if ((userID != null && userID.length > 0) && (termid != null && termid.length > 0)) {
       mongodbUtil.commonRemove(DB_CONN_STR,"t_user_history_video",{"f_vid":"null"},function(state7,error7,result7){
			if(state7=="0"){
						    //通过userid和termid查询指定用户的浏览历史记录
     mongodbUtil.commonSelect(DB_CONN_STR, "t_user_history_video",{ $query: { "f_id": userID,"termid":termid }, $orderby: { f_datetime: -1 } }, function(state, error, result) {
            if (state == "0") { //数据库操作正确执行
                //console.log(result);
                if (result != null && result.length > 0) {
						 ////////////////////xiaoliu add 2017-4-6//////////////////////////
	                var endflag=0;
	                var tmp='';
	                var data=new Array();
					result.map((issue)=>{
						var f_vid=issue.f_vid;
						var termid=issue.termid;
						var play_time=issue.playtime || '';
						var videoNumber=issue.f_epsode ||'';
						var f_datetime=issue.f_datetime||'';
						if(videoNumber.length>0){
						f_vid=f_vid+"."+videoNumber;
						//console.log(f_vid);
						var data1={"f_vid":f_vid,"playtime":play_time,"f_epsode":videoNumber,"f_datetime":f_datetime,"termid":termid};
						data.push(data1);
						console.log("++++++++++++++++"+data.termid);
						tmp=tmp+f_vid+',';
						endflag=endflag+1;
						if(endflag==result.length){
							tmp=tmp.slice(0,tmp.length-1);
							var url="http://www.go3c.tv:8030/backend/mobileott/api/php/php_video_list.php?vids="+tmp;
							console.log(url);
								request({
								    url: url,
								    method: "GET",
								    json: true,
								    headers: {
								    "content-type": "application/json",
								    }}, function(error, response, body) {
								    if (!error && response.statusCode == 200) {
									    var fflag=0;
									    data.map((issue1)=>{
											var vvid=issue1.f_vid;
											var ttermid=issue1.termid;
											var pptime=issue1.playtime;
											var vnum=issue1.f_epsode;
											var ttttmie=issue1.f_datetime;
											//vvid=vvid+vnum;
											response.body.map((issue2)=>{
												
												if(vvid==issue2.ID){
													fflag=fflag+1;
													issue2.playtime=pptime||'';	
													issue2.videoNumber=vnum ||'';
													issue2.f_datetime=ttttmie||'';
													issue2.termid=ttermid||'';
													if(fflag==data.length){
														//console.log(response.bo)
										returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body};
                    					res.send(returnInfo);								
													}																				
												}																	
											})							
										    
									    })
									    
									    //returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body,"playtime":data};
                    					//res.send(returnInfo);
									    //res.send(response.body)
								    }else{
									    returnInfo = { "state": "-1", "message": "内部获取数据出错！"};
                    					res.send(returnInfo);
								    }
								});													
						  }																				    							
                          }else{
	                          var data1={"f_vid":f_vid,"playtime":play_time,"f_epsode":videoNumber,"f_datetime":f_datetime,"termid":termid};
						data.push(data1);
						tmp=tmp+f_vid+',';
						endflag=endflag+1;
						if(endflag==result.length){
							tmp=tmp.slice(0,tmp.length-1);
							var url="http://www.go3c.tv:8030/backend/mobileott/api/php/php_video_list.php?vids="+tmp;
							//console.log(url);
								request({
								    url: url,
								    method: "GET",
								    json: true,
								    headers: {
								    "content-type": "application/json",
								    }}, function(error, response, body) {
								    if (!error && response.statusCode == 200) {
									    var fflag=0;
									    data.map((issue1)=>{
											var vvid=issue1.f_vid;
											var ttermid=issue1.termid;
											var pptime=issue1.playtime;
											var vnum=issue1.f_epsode;
											var ttttmie=issue1.f_datetime;
											//vvid=vvid+vnum;
											response.body.map((issue2)=>{
												
												if(vvid==issue2.ID){
													fflag=fflag+1;
													issue2.playtime=pptime||'';	
													issue2.videoNumber=vnum ||'';
													issue2.f_datetime=ttttmie||'';
													issue2.termid=ttermid||""
													if(fflag==data.length){
														console.log(response.bo)
										returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body};
                    					res.send(returnInfo);								
													}																				
												}																	
											})							
										    
									    })
									    
									    //returnInfo = { "state": "0", "message": "获取成功！", "videolist": response.body,"playtime":data};
                    					//res.send(returnInfo);
									    //res.send(response.body)
								    }else{
									    returnInfo = { "state": "-1", "message": "内部获取数据出错！"};
                    					res.send(returnInfo);
								    }
								});													
						  }																				    							
                          
                          }
						})		

                   
                } else {
                    returnInfo = { "state": "-1", "message": "userID无记录！" };
                    res.send(returnInfo);
                }
            } else { //数据库操作出现错误
                returnInfo = { "state": "-1", "message": error };
                res.send(returnInfo);
            }
        });
     	
			}else{
				returnInfo = { "state": "-1", "message": error7};
                res.send(returnInfo);
			}
	       
       })
    } else {
        returnInfo = { "state": "-1", "message": "userID is undefined" };
        res.send(returnInfo);
    }
})


/*
手机端获取终端直播播放记录接口
参数：termid=3&openid=xxxx   3:终端类型号  4:手机端类型号
返回值：终端播放信息数组
*/
app.get('/user/getLivetvHistory',function(req,res){

  	var termid = req["query"]["termid"] || ''
   	var openid = req["query"]["openid"] || ''   
    if(termid.length<=0 || openid.length<=0){
	    returnInfo={"state":"-1","message":"参数错误！"}
		res.send(returnInfo);
		return
    }
    var condition={"termid":termid,"openid":openid};
    mongodbUtil.commonSelect(DB_CONN_STR,"t_user_history_livetv",condition,function(state,error,result){
		if(state=="0"){
				if(result!=null &&result.length>0){//查询到结果返回
					returnInfo={"state":"1","message":"获取成功！","data":result};
					res.send(returnInfo);								
				}else{
					returnInfo={"state":"1","message":"此终端无播放记录！！","data":""};
					res.send(returnInfo);										
				}						
		}else{
			returnInfo={"state":"-1","errorid":"001","message":error};
			res.send(returnInfo);					
		}				
	    
    })
	
})




/*
终端获取手机端点播播放记录接口
参数：termid=4&openid=xxxx   3:终端类型号  4:手机端类型号
返回值：手机端播放信息数组
*/
app.get('/ott/getVodHistory',function(req,res){

  	var termid = req["query"]["termid"] || ''
   	var openid = req["query"]["openid"] || ''   
    if(termid.length<=0 || openid.length<=0){
	    returnInfo={"state":"-1","message":"参数错误！"}
		res.send(returnInfo);
		return
    }
    var condition={"termid":termid,"openid":openid};
    mongodbUtil.commonSelect(DB_CONN_STR,"t_user_history_video",condition,function(state,error,result){
		if(state=="0"){
				if(result!=null &&result.length>0){//查询到结果返回
					returnInfo={"state":"1","message":"获取成功！","data":result};
					res.send(returnInfo);								
				}else{
					returnInfo={"state":"1","message":"此用户无播放记录！！","data":""};
					res.send(returnInfo);										
				}						
		}else{
			returnInfo={"state":"-1","errorid":"001","message":error};
			res.send(returnInfo);					
		}				
	    
    })
	
})


/*
终端获取手机端直播播放记录接口
参数：termid=4&openid=xxxx   3:终端类型号  4:手机端类型号
返回值：手机端播放信息数组
*/
app.get('/ott/getLivetvHistory',function(req,res){

  	var termid = req["query"]["termid"] || ''
   	var openid = req["query"]["openid"] || ''   
    if(termid.length<=0 || openid.length<=0){
	    returnInfo={"state":"-1","message":"参数错误！"}
		res.send(returnInfo);
		return
    }
    var condition={"termid":termid,"openid":openid};
    mongodbUtil.commonSelect(DB_CONN_STR,"t_user_history_livetv",condition,function(state,error,result){
		if(state=="0"){
				if(result!=null &&result.length>0){//查询到结果返回
					returnInfo={"state":"1","message":"获取成功！","data":result};
					res.send(returnInfo);								
				}else{
					returnInfo={"state":"1","message":"此用户无播放记录！！","data":""};
					res.send(returnInfo);										
				}						
		}else{
			returnInfo={"state":"-1","errorid":"001","message":error};
			res.send(returnInfo);					
		}				
	    
    })
	
})




/*
删除单个大推小推屏消息
参数:userID=xxx&IMEI=xxx&_id=xx
返回值：推屏消息数组
*/
app.get('/user/removeMsg',function(req,res){
      var userID = req["query"]["userID"] || ''
      var IMEI = req["query"]["IMEI"] || ''
      var _id = req["query"]["_id"] || ''
      if( IMEI.length<=0 || userID.length<=0 || _id.length<=0 ){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_bigtosmall_msg",{"f_userid":userID,"f_imei":IMEI},function(state,error,result){
	  if(state=="0"){//数据库操作正常
		if(result!=null &&result.length>0){
			result.map((issue)=>{
				var id=issue._id;
				//console.log(id);
				if(id==_id){
						mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_bigtosmall_msg",{"_id":id},function(state1,error1,result1){
						if(state=="0"){
								returnInfo={"state":"1","message":"消息删除成功！"};
				 				res.send(returnInfo);							
							}else{
						 		returnInfo={"state":"-1","errorid":"001","error":error1}
				 	 			res.send(returnInfo);
							}																	
					   })
				}				
				
			})			      		
			}else{
				returnInfo={"state":"1","message":"没有此消息记录！"};
		 		res.send(returnInfo);		
			}		
		}else{
			 returnInfo={"state":"-1","errorid":"002","error":error}
		 	 res.send(returnInfo);				
		}					 
	 })

	
})



/*
删除多个大推小推屏消息
参数:userID=xxx&IMEI=xxx&_id=逗号隔开
返回值：推屏消息数组
*/
app.get('/user/removeManyMsg',function(req,res){
       var userID = req["query"]["userID"] || ''
      var IMEI = req["query"]["IMEI"] || ''
      var _id = req["query"]["_id"] || ''
      if( IMEI.length<=0 || userID.length<=0 || _id.length<=0 ){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	
	 if (_id.indexOf(",") != -1){ //存在多个值
	    console.log("多值处理！");
		var _idarray=_id.split(",");
		var len=_idarray.length;
		var flag=0;
		//_idarray.forEach(function(v){
		//console.log(userID +"  "+ IMEI)
		mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_bigtosmall_msg",{"f_userid":userID,"f_imei":IMEI},function(state2,error2,result2){
			if(state2=="0"){				
				if(result2!=null &&result2.length>0){					
				    _idarray.forEach(function(v){					    	
						result2.map((issue)=>{
							var id=issue._id;														
							if(id==v){							   
								mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_bigtosmall_msg",{"_id":id},function(state1,error,result1){
									if(state1=="0"){
										flag=flag+1;
										if(flag==len){
											returnInfo={"state":"1","message":"删除完成！"}
		 	            					res.send(returnInfo);				
										}			
									}else{
										returnInfo={"state":"-1","errorid":"001","error":error1}
		 	            				res.send(returnInfo);						
											
									}														

								})											
							}												
						})												
                    })
				}else{
					returnInfo={"state":"-1","message":"没有该用户消息"}
	 	            res.send(returnInfo);										
				}									

			}else{
				returnInfo={"state":"-1","errorid":"002","error":error2}
	 	        res.send(returnInfo);					
			}								
		})																												
	 }else{//数组只有一个值
	 console.log("单值处理");
		 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_bigtosmall_msg",{"f_userid":userID,"f_imei":IMEI},function(state,error,result){
	  if(state=="0"){//数据库操作正常
		if(result!=null &&result.length>0){
			result.map((issue)=>{
				var id=issue._id;
				//console.log(typeof(id)+"  "+typeof(_id));			
				if(id==_id){
						mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_bigtosmall_msg",{"_id":id},function(state1,error1,result1){
						if(state=="0"){
								returnInfo={"state":"1","message":"消息删除成功！"};
				 				res.send(returnInfo);							
							}else{
						 		returnInfo={"state":"-1","errorid":"001","error":error1}
				 	 			res.send(returnInfo);
							}																	
					   })
				}else{
					console.log("!!!!!!!");				
				}				
				
			})			      		
			}else{
				returnInfo={"state":"1","message":"没有此消息记录！"};
		 		res.send(returnInfo);		
			}		
		}else{
			 returnInfo={"state":"-1","errorid":"002","error":error}
		 	 res.send(returnInfo);				
		}					 
	 })

									

	 
	 }
	
})




/*
清空大推小推屏消息
参数:userID=xxx&IMEI=xxx
返回值：推屏消息数组
*/
app.get('/user/removeAllMsg',function(req,res){
      var userID = req["query"]["userID"] || ''
      var IMEI = req["query"]["IMEI"] || ''
      //var _id = req["query"]["_id"] || ''
      if( IMEI.length<=0 || userID.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_bigtosmall_msg",{"f_userid":userID,"f_imei":IMEI},function(state,error,result){
	  if(state=="0"){//数据库操作正常
									
			returnInfo={"state":"1","message":"消息已清空！"}
		 	res.send(returnInfo);					
				
		}else{
			 returnInfo={"state":"-1","errorid":"002","error":error}
		 	 res.send(returnInfo);				
		}					 
	 })

	
})




/*
微信公众号openid和用户IMEI、userID关系接口
参数：userID=xxx&IMEI=xxx&wx_openid=xxx
返回值：成功/失败
*/
app.get('/ottuser/wxUserRelation',function(req,res){
  var userID = req["query"]["userID"] || ''
  var IMEI = req["query"]["IMEI"] || ''
  var wx_openid = req["query"]["wx_openid"] || ''
  var sessionid = req["query"]["sessionid"] || ''
    if(userID.length<=0 || IMEI.length<=0 ||wx_openid.length<=0 ||sessionid.length<=0){
	    returnInfo={"state":"-1","message":"参数错误！"}
		res.send(returnInfo);
		return
    }
    var time=getCurTime("yyyy-MM-dd hh:mm:ss")
    var condition={"f_userid":userID,"f_imei":IMEI,"f_wx_openid":wx_openid};    
    mongodbUtil.commonSelect(DB_CONN_STR,"t_ottuser_wx_relation",condition,function(state,error,result){
	    if(state=="0"){
		    if(result!=null && result.length>0){//查询到结果说明已经存在用户与微信的关系
		    	result.f_status='1';
		    	var _id=result._id;
		    	
			    returnInfo={"state":"-1","message":"该用户已经注册过！"}
			    res.send(returnInfo)
		    }else{
			    mongodbUtil.commonInsert(DB_CONN_STR,"t_ottuser_register",condition_up,function(state1,error1,result1){
				    if(state1=="0"){
					    returnInfo={"state":"1","message":"注册成功！"}
			    		res.send(returnInfo)
				    }else{
					    returnInfo={"state":"-1","errorid":"001","message":error1};
						res.send(returnInfo);
				    }
			    })
		    }
	    }else{
		    returnInfo={"state":"-1","errorid":"002","message":error};
			res.send(returnInfo);
	    }
    })
	
})



/*
微信公众号openid和用户IMEI、userID关系接口
参数：userID=xxx&IMEI=xxx&wx_openid=xxx
返回值：成功/失败
*/
app.get('/ottuser/wxUserRelation',function(req,res){
  var userID = req["query"]["userID"] || ''
  var IMEI = req["query"]["IMEI"] || ''
  var wx_openid = req["query"]["wx_openid"] || ''
  var sessionid = req["query"]["sessionid"] || ''
    if(userID.length<=0 || IMEI.length<=0 ||wx_openid.length<=0 ||sessionid.length<=0){
	    returnInfo={"state":"-1","message":"参数错误！"}
		res.send(returnInfo);
		return
    }
    var time=getCurTime("yyyy-MM-dd hh:mm:ss")
    var condition={"f_userid":userID,"f_imei":IMEI,"f_wx_openid":wx_openid};    
    mongodbUtil.commonSelect(DB_CONN_STR,"t_ottuser_wx_relation",condition,function(state,error,result){
	    if(state=="0"){
		    if(result!=null && result.length>0){//查询到结果说明已经存在用户与微信的关系
		    	result.f_status='1';
		    	var _id=result._id;
		    	
			    returnInfo={"state":"-1","message":"该用户已经注册过！"}
			    res.send(returnInfo)
		    }else{
			    mongodbUtil.commonInsert(DB_CONN_STR,"t_ottuser_register",condition_up,function(state1,error1,result1){
				    if(state1=="0"){
					    returnInfo={"state":"1","message":"注册成功！"}
			    		res.send(returnInfo)
				    }else{
					    returnInfo={"state":"-1","errorid":"001","message":error1};
						res.send(returnInfo);
				    }
			    })
		    }
	    }else{
		    returnInfo={"state":"-1","errorid":"002","message":error};
			res.send(returnInfo);
	    }
    })
	
})


/*
终端解绑单个用户接口
参数：userID=xxx&IMEI=xxx&mac=xxx
返回值：成功/失败
*/
app.get('/ott/unbindOne',function(req,res){

	 var IMEI = req["query"]["IMEI"] || ''
	 var userID = req["query"]["userID"] || ''
	 var mac = req["query"]["mac"] || ''
	 
	 if(mac.length<=0 || userID.length<=0 || IMEI.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_mac":mac,"f_imei":IMEI,"f_userid":userID};
	 var condition_upp={"f_imei":IMEI,"f_userid":userID};
     mongodbUtil.commonSelect(DB_CONN_STR, "t_ott_user_bind", condition, function(state, error, result) {
		if(state=="0"){
			if(result != null &&result.length>0){
				mongodbUtil.commonRemove(DB_CONN_STR,"t_ott_user_bind",condition,function(state1,error1,result1){
					if(state1=="0"){
						mongodbUtil.commonSelect(DB_CONN_STR,"t_user_login_status",condition_upp,function(state3,error3,result3){
														if(state3=="0"){											
															if(result3!=null &&result3.length>0){
																if(result3[0].f_status=="1"){//手机在线
																    var socketid=result3[0].f_socketid||'';
																    if(socketid!=null&&socketid.length>0){
																	    var publishdata={"socketid":socketid,"data":mac};	
																		 console.log(JSON.stringify(publishdata))			
																		 var client = redis.createClient(6379, "www.go3c.tv");
																		 client.auth('go3credis',function(){
																      			console.log("redis通过认证！！")
															      			});
															      		 client.on("error",function(err){  
															                   console.log("err"+err);  
															                }); 
															             client.on('ready',function(){  
															                client.publish('OTT_TVUNBIND',JSON.stringify(publishdata));              
															                client.end(true);
															      			returnInfo={"state":"1","message":"解绑成功，通知手机端成功！","data":""}
															      			res.send(returnInfo);     
															        	});
																    }else{
																	    returnInfo={"state":"1","message":"解绑成功，手机端不在线！","data":""}
															      		res.send(returnInfo); 
																    }
																	
																}else{
																	returnInfo={"state":"1","message":"解绑成功，手机端不在线！","data":""}
															      	res.send(returnInfo);
																}
																											
															}else{
																returnInfo={"state": "0","message":"解绑成功，没有用户信息！"}
																res.send(returnInfo);													
															}				
														}else{
															returnInfo = { "state": "-1", "errorid":"004","message": error3 };
                											res.send(returnInfo);					
														}					
												   }) 
									   						
												
						
						/*returnInfo={"state":"1","message":"解除绑定成功！","data":condition}
						res.send(returnInfo)*/						
					}else{
						returnInfo={"state": "-1", "errorid":"001","message": error1}
						res.send(returnInfo)									
					}												

				})											
			}else{
				returnInfo={"state":"1","message":"没有此绑定记录！","data":""}
				res.send(returnInfo)							
			}										
		}else{
			returnInfo={"state": "-1", "errorid":"002","message": error}
			res.send(returnInfo)							
		}												

	}) 
	 								
	
})


/*
手机遥控板接口
参数：userID=xxx&mac=xxx&IMEI=xxx&data=xxx
返回值：成功/失败
*/
app.get('/ott/mobileControler',function(req,res){
	 var userID = req["query"]["userID"] || ''
	 var mac = req["query"]["mac"] || ''
	 var data = req["query"]["data"] || ''
	 var IMEI = req["query"]["IMEI"] || ''
	 var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");
	 if(userID.length<=0 || mac.length<=0 ||data.length<=0 || IMEI.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }
	 var condition={"f_mac":mac};	
	 mongodbUtil.commonSelect(DB_CONN_STR,"t_ott_status",condition,function(state2,error2,result2){
                if(state2=="0"){
					if(result2!=null &&result2.length>0){//有该终端信息则判断在线状态
						var socketid=result2[0].f_socketid ||'';
						if(socketid!=null && socketid.length>0){ //终端在线时则进行键值发送
							var publishdata={"socketid":socketid,"data":data,"userID":userID};								 			
							 var client = redis.createClient(6379, "www.go3c.tv");
							 client.auth('go3credis',function(){
					      			console.log("redis通过认证！！")
				      			});
				      		 client.on("error",function(err){  
				                   console.log("err"+err);  
				                }); 
				             client.on('ready',function(){  
				                client.publish('OTT_CONTROLER',JSON.stringify(publishdata));              
				                client.end(true);
				             returnInfo={"state":"1","message":"推送成功！","data":condition}
				             res.send(returnInfo);     
				        });			
						}else{
							returnInfo={"state":"-1","message":"终端不在线！"}
		   		    		res.send(returnInfo);
						}			
	                
                }else{
	               	returnInfo={"state":"-1","message":"无此终端信息！"}
		   		    res.send(returnInfo);			
                }
            }else{
	            		returnInfo={"state": "-1", "errorid":"001","message": error2}
						res.send(returnInfo)
            }
		 })		
     	
})



//大喇叭接口
app.post('/ott/bigMessage',function(req,res){
	 //var userID = req["query"]["userID"] || ''
	// var mac = req["query"]["mac"] || ''
	// var data = req["query"]["data"] || ''
	 //var IMEI = req["query"]["IMEI"] || ''
	/// var datetime=getCurTime("yyyy-MM-dd hh:mm:ss");
	 /*if(userID.length<=0 || mac.length<=0 ||data.length<=0 || IMEI.length<=0){
		 returnInfo={"state":"-1","message":"参数错误！"}
		 res.send(returnInfo);
		 return
	 }*/
							 var body = req.body;
							 console.log(body.data[0]);
							 var message=body.data[0];
							 var data={"f_message":message};
							 var publishdata={"socketid":null,"data":data};								 			
							 var client = redis.createClient(6379, "www.go3c.tv");
							 client.auth('go3credis',function(){
					      			console.log("redis通过认证！！")
				      			});
				      		 client.on("error",function(err){  
				                   console.log("err"+err);  
				                }); 
				             client.on('ready',function(){  
				                client.publish('OTT_NOTICE',JSON.stringify(publishdata));              
				                client.end(true);
				             returnInfo={"state":"1","message":"推送成功！"}
				             res.send(returnInfo);     
				        });		
     	
})







/*xiaoliu add end*/




///////////////////////////////////////////////////////////////////////////////


server.listen(PORT);
console.log('server.listen '+ PORT);
/*
 ** randomWord 产生任意长度随机字母数字组合
 ** randomFlag-是否任意长度 min-任意长度最小位[固定位数] max-任意长度最大位
 ** gao 2015-05-10
 */
var randomWord = function(randomFlag, min, max) {
    var str = "",
        range = min,
        arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    // 随机产生
    if (randomFlag) {
        range = Math.round(Math.random() * (max - min)) + min;
    }
    for (var i = 0; i < range; i++) {
        pos = Math.round(Math.random() * (arr.length - 1));
        str += arr[pos];
    }
    return str;
}




/*
 ** 对Date的扩展，将 Date 转化为指定格式的String   
 ** 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，   
 ** 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)   
 ** 例子：   
 ** (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423   
 ** (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18   
 */
var getCurTime = function(fmt) {
    var curDate = new Date();

    var o = {
        "M+": curDate.getMonth() + 1, //月份   
        "d+": curDate.getDate(), //日   
        "h+": curDate.getHours(), //小时   
        "m+": curDate.getMinutes(), //分   
        "s+": curDate.getSeconds(), //秒   
        "q+": Math.floor((curDate.getMonth() + 3) / 3), //季度   
        "S": curDate.getMilliseconds() //毫秒   
    };

    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (curDate.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));

    return fmt;
}



/*
 ** 判断 若变量是一个空对象或空数组，就返回true  
 */
var isEmpty = function(value) {
    return (Array.isArray(value) && value.length === 0) || (Object.prototype.isPrototypeOf(value) && Object.keys(value).length === 0);
}

/*
 * @desc : 获取配置文件参数
 * @params : 
 * @return : go3c_screenShot_livetv_list.json文件数据
 */
// var get_livetv_conf = function get_livetv_conf() {
//     var data = fs.readFileSync(config_file_url.go3c_screenShot_livetv_list);
//     data = JSON.parse(data);
//     return data;
// }

// 判断日志目录是否存在，不存在时创建日志目录  
function checkAndCreateDir(dir){  
    if(!fs.existsSync(dir)){  
        fs.mkdirSync(dir);  
    }  
}  
  
// 指定的字符串是否绝对路径  
function isAbsoluteDir(path){  
    if(path == null)  
        return false;  
    var len = path.length;  
  
    var isWindows = process.platform === 'win32';  
    if(isWindows){  
        if(len <= 1)  
            return false;  
        return path[1] == ":";  
    }else{  
        if(len <= 0)  
            return false;  
        return path[0] == "/";  
    }  
}  

/*
 * @desc : 获取配置文件参数
 * @params : 
 * @return : go3c_nodejs_conf.json文件数据
 */
var get_go3c_nodejs_conf = function get_go3c_nodejs_conf() {
    /*var groupid = nodejs_conf["GROUPID"];
    var scene = nodejs_conf["SCENE"];
    var areaid = nodejs_conf["AREA"];
    var position = nodejs_conf["POSITION"];
    var ip = nodejs_conf["IP"];
    //var wanmac = nodejs_conf["WANMAC"];
    var lanmac = nodejs_conf["LANMAC"];
    var spid = nodejs_conf["SPID"];
    var uuid = nodejs_conf["UUID"];*/

    var data = fs.readFileSync(path.join(__dirname, config_file_url.go3c_nodejs_conf));
    var gid = "";
    var uuid = "";
    var spid = "";
    var media_version = "";
    var scene = "";
    var area = "";
    var position = "";
    var lanmac = "";
    var ip = "";
    var conf = {};
    data = JSON.parse(data)
    data['data']['conf'].forEach(function(v) {
        switch (v['c_name']) {
            case "GROUPID":
                gid = v['c_value'];
                break;
            case "UUID":
                uuid = v['c_value'];
                break;
            case "SPID":
                spid = v['c_value'];
                break;
            case "MEDIA_VERSION":
                media_version = v['c_value'];
                break;
            case "SCENE":
                scene = v['c_value'];
                break;
            case "IP":
                ip = v['c_value'];
                break;
            case "LANMAC":
                lanmac = v['c_value'];
                break;
            case "POSITION":
                position = v['c_value'];
                break;
            case "AREA":
                area = v['c_value'];
        }
    });
    conf["GROUPID"] = gid;
    conf["UUID"] = uuid;
    conf["SPID"] = spid;
    conf["MEDIA_VERSION"] = media_version;
    conf["SCENE"] = scene;
    conf["AREA"] = area;
    conf["POSITION"] = position;
    conf["IP"] = ip;
    conf["LANMAC"] = lanmac;
    return conf;
}

/*调用刮刮卡导入接口*/
//importguaguakadata();
/*启动定时任务*/
//timerTask.timerSchedule();
//snapshotauto();
/*定时20分钟拉取产品包*/
//timerTask.timerScheduleForproduct_data();
