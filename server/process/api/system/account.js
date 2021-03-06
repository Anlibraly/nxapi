var msg = require('../../../common/msg');
var request = require('request');
var _   = require('underscore');
var md5 = require('md5');

var check = (v) => {
    if(v != undefined && (v > 0 || v.length>0)){
        return true;
    }
    return false;
}

var getThroughDataProc = (type, optype, sendData) => {
	return msg.send(`data@${type}.${optype}`, sendData)
	.then(({result, res}) => {
		return Promise.resolve(result);
	});
};

module.exports = ( router ) => {

	router
	.get('/account/getUserIp', function *() {

		let ip = this.req.headers['x-forwarded-for'] ||
    			 this.req.connection.remoteAddress ||
    			 this.req.socket.remoteAddress ||
    			 this.req.connection.socket.remoteAddress;

    	this.session.userip = ip;

		this.body = {
			result : {ip: ip},
			res : {
				status : true
			}
		};

	})
	.get('/account/getUserInfo/:code',function *(){
		if(!this.params.code) {
			this.body = {
				result : 'invalid code',
				res : {
					status : false
				}
			};
			return;			
		}
		let url = `https://api.weixin.qq.com/sns/jscode2session?appid=wxc322fe742afc756b&secret=b0bb57153552e5b3144e7b71ffbecf90&js_code=${this.params.code}&grant_type=authorization_code`;
		let that = this;

		yield new Promise(function(resolve, reject) {
			request(url, (err, res, body) => {
				if(err){
					that.body = {
						result : err,
						res : {
							status : false
						}
					};
					resolve();	
				}
				try {
					body = JSON.parse(body)
					if(body.openid) {
						getThroughDataProc('db', 'query', {
							_key: 'userinfo',
							openid: body.openid
						})
						.then((result) => {
							let hasResult = (result.list && result.list.length);
							let user = null;
							if(hasResult && result.list[0]){
								user = result.list[0];
								that.session.userid = user._id;
								that.session.openid = user.openid;
								that.body = user;
								resolve();				
							}else{
								user = {
									tel: '',
									gender:	'男',
									relation: '',
									nickname: '',
									birth:	'2010-01-01',
									wxname:	'',
									openid:	body.openid,
									userdata:	''								
								};

								return getThroughDataProc('db', 'save', {
									_key: 'userinfo',
									_save: [user]
								})
								.then(() => {
									that.body = user;
									resolve();
								});
							}
						})
						.catch((err) => {
							console.log(`[error] ${err.message}\n${err.stack}`)
							that.body = {
								code: -1,
								desc: `[error] ${err.message}\n${err.stack}`
							};	
							resolve();		
						});					
					} else {
						that.body = {
							code: -1,
							desc: 'no data from server'
						};
						resolve();
					}
				} catch (e) {
					that.body = {
						code: -1,
						desc: 'invaild data from server'
					};
					resolve();
				}
			});	
		});	
	})
	.post('/account/updateUserInfo',function *(){
		let body = this.request.body;

		if(body.openid) {
			yield getThroughDataProc('db', 'query', {
				_key: 'userinfo',
				openid: body.openid
			})
			.then((result) => {
				let hasResult = (result.list && result.list.length);
				let user = {};
				if(hasResult && result.list[0]){
					user = result.list[0];	
				}

				user.birth = body.birth;
				user.gender = body.gender;
				user.nickname = body.nickname;
				user.relation = body.relation;
				user.wxname = body.wxname;
				user.openid = body.openid;

				return getThroughDataProc('db', 'save', {
					_key: 'userinfo',
					_save: [user]
				})
				.then(() => {
					this.body = {
						code: 1,
						user: user
					};
				});	
			});
		} else {
			this.body = {
				code: -1,
				msg: 'invaild openid'
			};
		}
	})
	.post('/account/updateAnswer',function *(){
		let body = this.request.body;

		if(body.openid && !_.isEmpty(body.ans)) {
			yield getThroughDataProc('db', 'query', {
				_key: 'userinfo',
				openid: body.openid
			})
			.then((result) => {
				let hasResult = (result.list && result.list.length);
				let user = null;
				if(hasResult && result.list[0]){
					user = result.list[0];
					let oldata = JSON.parse(user.userdata ? user.userdata : '{}');
					oldata = _.extend(oldata, body.ans);
					user.userdata = JSON.stringify(oldata);

					return getThroughDataProc('db', 'save', {
						_key: 'eachdata',
						_save: [{
							openid: body.openid,
							item: _.keys(body.ans)[0],
							uptime: +new Date(),
							data: JSON.stringify(body.ans)
						}]
					})
					.then(() => getThroughDataProc('db', 'save', {
						_key: 'userinfo',
						_save: [user]
					}))
					.then(() => {
						this.body = {
							code: 1,
							user: user
						};
					});		
				}
			});
		} else {
			this.body = {
				code: -1,
				msg: 'invaild openid or invaild ans'
			};
		}
	})
	.post('/account/uploadDlrecord',function *(){
		let body = this.request.body;

		if(body.openid && !_.isEmpty(body.dlRecord)) {
			yield getThroughDataProc('db', 'query', {
				_key: 'userinfo',
				openid: body.openid
			})
			.then((result) => {
				let hasResult = (result.list && result.list.length);
				if(hasResult && result.list[0]){
					return getThroughDataProc('db', 'save', {
						_key: 'eachdata',
						_save: [{
							openid: body.openid,
							item: 'dingliang',
							uptime: +new Date(),
							data: JSON.stringify(body.dlRecord)
						}]
					})
					.then(() => getThroughDataProc('db', 'query', {
						_key: 'eachdata',
						openid: body.openid,
						item: 'dingliang'
					}))
					.then((dlr) => {
						this.body = {
							code: 1,
							items: dlr.list
						};
					});	
				}
			});
		} else {
			this.body = {
				code: -1,
				msg: 'invaild openid or invaild ans'
			};
		}
	})
	.get('/account/getDlitems/:oid',function *(){
		if(!this.params.oid) {
			this.body = {
				code: -1,
				msg : 'invalid oid',
			};
			return;			
		}
		yield getThroughDataProc('db', 'query', {
			_key: 'userinfo',
			openid: this.params.oid
		})
		.then((result) => {
			let hasResult = (result.list && result.list.length);
			if(hasResult && result.list[0]){
				return getThroughDataProc('db', 'query', {
					_key: 'eachdata',
					openid: this.params.oid,
					item: 'dingliang'
				})
				.then((dlr) => {
					let hasResult = (dlr.list && dlr.list.length);
					let items = [];
					if(hasResult) {
						items = dlr.list;
					}

					this.body = {
						code: 1,
						items
					};
				});		
			}
		});
	})	
	.get('/account/logout', function *() {
		this.session.userid = null;
                this.session.username = null;
                this.session.nick_name = null;
                this.session.type = -1;

		this.redirect('/');
	})
	.post('/account/login', function *() {
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', {
			_key: 'user',
			username: this.request.body.username,
			password: this.request.body.password
		}))
		.then((result) => {
			let hasResult = (result.list && result.list.length);
			let user = null;
			if(hasResult && result.list[0]){
				user = result.list[0];
				this.session.userid = user._id;
				this.session.username = user.username;
				this.session.nick_name = user.nick_name;
				this.session.type = user.type;
				let des = '/salesman/index.html';
				if(user.type === 2){
					des = '/admin/index.html';
				}
				this.body = {
					code: 1,
					desc: des
				};				
			}else{
				this.body = {
					code: -1,
					desc: '用户名密码错误'
				};
			}
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});
	})
	.get('/admin/getcustom/:status/:sid', function *() {
		let qs = null;
		if(this.params.status != undefined && this.params.status > 0){
			qs = {
				_key: 'custom',
				status: this.params.status,
				_sort: 'update_time:desc'
			};
		}else{
			qs = {
				_key: 'custom',
				_sort: 'update_time:desc'
			};
		}
		if(this.params.sid != undefined && this.params.sid > 0){
			qs.userid = +this.params.sid;
		}		
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', qs))
		.then((result) => {
			this.body = {
				code: 1,
				customs: result.list
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.get('/admin/unreadCustom', function *() {
		let qs = {
			_key: 'custom',
			_sort: 'update_time:desc',
			read: '#='+`${this.session.userid}-`
		};

		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', qs))
		.then((result) => {
			this.body = {
				code: 1,
				customs: result.list
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.get('/admin/custom/:cid',function *(){
		let customs, qs = {
				_key: 'custom',
				_id: this.params.cid
		};
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', qs))
		.then((result) => {
			let read = result.list[0].read;
			if(read.indexOf(`${this.session.userid}-`) < 0){
				read += `${this.session.userid}-`;
			}
			customs = result;
			return getThroughDataProc('db', 'save', {
				_key: 'custom',
				_save: [{
					_id: +this.params.cid,
					read: read
				}]
			});
		})
		.then((result) => {
			this.body = {
				code: 1,
				customs: customs.list
			};	
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.get('/admin/getSalesman',function *(){
		let qs = {
				_key: 'user',
				type: 1
		};
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', qs))
		.then((result) => {
			let saleMans = [];
			_.each(result.list, (v) => {
				saleMans.push({
					_id: v._id,
					username: v.username,
					nick_name: v.nick_name
				});
			})
			this.body = {
				code: 1,
				salesmans: saleMans
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.post('/admin/addCustom',function *(){
		let {cname, tel_num, goal_fang, job, size,
			 price, deadline, reason, now_address,
			 other_mark, salesman, _id} = this.request.body;
		let desc = '添加成功';
		let date = new Date();
		if(check(cname) && check(tel_num) && check(goal_fang) && check(size)
		&& check(price) && check(deadline) && check(reason) && check(salesman)){
			let addtime = date.getTime();
			date.setHours(0);
			date.setMinutes(0);
			date.setSeconds(0);

			let y = date.getFullYear()-2000, m = date.getMonth()+1, d = date.getDate();
		    if(m < 10){
		    	m = '0' + m;
		    }
		    if(d < 10){
		    	d = '0' + d;
		    }			
			let todate = `${y}${m}${d}`;
			let today = +date.getTime();
			let t = deadline.split('-');
			if(t.length == 3){
				date.setFullYear(+t[0]);
				date.setMonth(+t[1]-1);
				date.setDate(+t[2]);
			}			
			let custom = {
			  	userid: +salesman,
			  	cname: cname,
			  	tel_num: ''+tel_num,
			  	goal_fang: goal_fang,
			  	goal_fang_id: -1,
			  	job: job == undefined ? '' : job,
			  	size: size+'',
			  	price: price+'',
			  	deadline: +date.getTime(),
			  	move_reason: reason,
			  	now_address: now_address == undefined ? '' : now_address,
			  	other_mark: other_mark == undefined ? '' : other_mark,
			  	update_time: +addtime,
			  	add_time: +addtime,
			  	status: 0,
			  	add_status: 0,
			  	read: `${this.session.userid}-`
			};
			if(_id !== null && _id !== undefined && +_id >=0 && _id !== ''){
				custom._id = _id;
				desc = '修改成功';
			}else{
				desc = '添加成功';			
			}
			yield Promise.resolve()
			.then(() => getThroughDataProc('db', 'query', {
				_key: 'custom',
				add_time: '>='+today
			}))
			.then((result) => { 
				if(desc === '添加成功'){
					result = result.list;
					let num = '01';
					if(result && result.length > 8){
						num = result.length+1;
					}else if(result && result.length > 0){
						num = '0' + (result.length+1);
					}

					custom.cid = todate + '' + num;
				}
				let qs = {
						_key: 'custom',
						_save: [custom]
				};
				return getThroughDataProc('db', 'save', qs);
			})
			.then((result) => {
				this.body = {
					code: 1,
					desc: desc
				};				
			})
			.catch((err) => {
				console.log(`[error] ${err.message}\n${err.stack}`)
				this.body = {
					code: -1,
					desc: `[error] ${err.message}\n${err.stack}`
				};			
			});
		}else{
			this.body = {
				code: 1,
				desc: '请输入完整客户信息'
			};				
		}		
	})
	.post('/admin/updateCustom',function *(){
		let qs = {
				_key: 'custom',
				_save: [{
					_id: +this.request.body.userid,
					userid: +this.request.body.salesman,
					read: `${this.session.userid}-`
				}]
		};
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'save', qs))
		.then((result) => {
			this.body = {
				code: 1,
				desc: '更新成功'
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.get('/admin/getcotact/:cid', function *() {
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', {
			_key: 'contact',
			_sort: 'contact_time:desc',
			custom_id: this.params.cid
		}))
		.then((result) => {
			this.body = {
				code: 1,
				contacts: result.list
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.get('/salesman/getcustom/:status', function *() {
		let qs = null;
		if(this.params.status != undefined && this.params.status > 0){
			qs = {
				_key: 'custom',
				userid: this.session.userid,
				status: this.params.status,
				_sort: 'update_time:desc'
			};
		}else{
			qs = {
				_key: 'custom',
				userid: this.session.userid,
				_sort: 'update_time:desc'
			};
		}
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', qs))
		.then((result) => {
			this.body = {
				code: 1,
				customs: result.list
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.get('/salesman/custom/:cid',function *(){
		let qs = {
				_key: 'custom',
				_id: this.params.cid,
				userid: this.session.userid
		};

		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', qs))
		.then((result) => {
			this.body = {
				code: 1,
				customs: result.list
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.get('/salesman/getcotact/:cid', function *() {
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', {
			_key: 'contact',
			_sort: 'contact_time:desc',
			custom_id: this.params.cid
		}))
		.then((result) => {
			this.body = {
				code: 1,
				contacts: result.list
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.post('/salesman/addcotact', function *() {
		let in_data = this.request.body;
		let cid = in_data.cid,
			status = in_data.status;
		if (!cid||cid<0||typeof(cid)!='number'||!(status>0&&status<6)) {
			this.body = {
				code: -1,
				desc: '请传入正确的客户id和跟进进度'
			};	
		}
		let data = {}, 
			ctm = in_data.ctime, 
			dt = in_data.detail;
		try{
			let t = ctm.split('-');
			let d = new Date();
			d.setFullYear(+t[0]);
			d.setMonth(+t[1]-1);
			d.setDate(+t[2]);
			ctm = d.getTime();
			data.custom_id = +cid;
			data.contact_time = (ctm == undefined||ctm < 1272141884)?(+new Date()) : ctm;
			data.detail = (dt == undefined || dt.length < 1)? '暂无详情':dt;
			data.status = +status;
			data.userid = +this.session.userid;
			data.add_time = (+new Date());
			let save = [];
			save.push(data);

			yield Promise.resolve()
			.then(() => getThroughDataProc('db', 'save', {
				_key: 'contact',
				_save: save
			}))
			.then((result) => getThroughDataProc('db', 'save', {
					_key: 'custom',
					_save: [{
						_id: +cid,
						status: +status,
						read: '',
						update_time: ctm						
					}]
			}))
			.then((result) => {	
				this.body = {
					code: 1,
					desc: '添加成功'
				};	
			})
			.catch((err) => {
				console.log(`[error] ${err.message}\n${err.stack}`)
				this.body = {
					code: -1,
					desc: `[error] ${err.message}\n${err.stack}`
				};			
			});	
		}catch(e){
			this.body = {
				code: -1,
				desc: `[error] ${e.message}\n${e.stack}`
			};				
		}	
	})
	.get('/salesman/getfang/:fid', function *() {
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', {
			_key: 'fang',
			_id: this.params.fid
		}))
		.then((result) => {
			this.body = {
				code: 1,
				contacts: result.list
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.get('/salesman/getlou/:lid', function *() {
		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'query', {
			_key: 'lou',
			_id: this.params.lid
		}))
		.then((result) => {
			this.body = {
				code: 1,
				contacts: result.list
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	})
	.post('/salesman/soufang', function *() {
		let in_data = this.request.body;

		yield Promise.resolve()
		.then(() => getThroughDataProc('db', 'queryFang', {
			_fsize: in_data.fsize,
			_per_price: in_data.per_price,
			_total_price: in_data.total_price,
			_ftype: in_data.ftype,
			_update: in_data.update,
			_f_name: in_data.f_name
		}))
		.then((result) => {
			this.body = {
				code: 1,
				fangs: result
			};				
		})
		.catch((err) => {
			console.log(`[error] ${err.message}\n${err.stack}`)
			this.body = {
				code: -1,
				desc: `[error] ${err.message}\n${err.stack}`
			};			
		});		
	});

};
