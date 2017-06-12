/* 
 * @desc : 接口库
 * @createtime : 2016-05-10 11:04
 * @updatetime : 2017-06-06 09:48 
 * @author : liu
 */
var http = require('http');
var querystring = require("querystring");
var express = require('express'); //导入express
var bodyParser = require('body-parser'); //导入body-parser
var url = require('url');
var util = require('util');
var fs = require('fs');
var redis = require("redis");//redis发布订阅
var request = require('request'); //xiaoliu add 2017-4-6
var mongodbUtil = require('./util_mongodb.js'); //导入util_mongodb.js
var util_common = require('./util_common.js'); //导入util_common.js
var app = express();
var server = require('http').createServer(app);
var PORT = 7005;
var DB_HOST = "127.0.0.1"; //数据库host
var DB_PORT = 27017; //数据库端口
var DB_NAME = "chinaMobile20170327"; //数据库名
var DB_CONN_STR = "mongodb://" + DB_HOST + ":" + DB_PORT + "/" + DB_NAME;


/////////////////////////////////////////////////////////////////////////////


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




