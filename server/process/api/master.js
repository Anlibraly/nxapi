var koa 	 = require('koa');
var router 	 = require('koa-router');
var morgan 	 = require('koa-morgan');
var koaBody  = require('koa-body');
var mount 	 = require('koa-mount');
var session  = require('koa-session');
var _ 		 = require('underscore');
var render = require('koa-ejs');
var conditional = require('koa-conditional-get');
var staticServer = require('koa-static');
var etag = require('koa-etag');
var path = require('path');
var file 	 = require('../../common/file');
var msg 	 = require('../../common/msg');
var pmid 	 = process.env.pm_id;
var app 	 = koa();
var systemApi 	 = koa();
var systemRouter = router();
var conf = {
	apiPort: '8084',
	//serverAddress: '139.196.195.37'
	serverAddress: '127.0.0.1'	
};

// ================================================================================
// Api Service
// ================================================================================
var apiServer = () => {

	app.listen(conf.apiPort);
	var opts = {maxAge: 2*60*60*1000, key:'nxapi-session-2018'};
	app.keys = ['nxapi-session-2018'];
	app.use(session(opts, app));

	app.on('error', function(err,ctx){
		console.log(err);
	});

	app.use(morgan.middleware('dev'))
	.use(koaBody({
		jsonLimit : '10mb',
		formLimit : '10mb',
		textLimit : '10mb'
	}))
	.use(function *(next){
		yield next;
		var url = this.request.url;
		this.response.set('nxapi-server', `api/${pmid}`);
		this.response.set('Access-Control-Allow-Origin', conf.serverAddress.replace(/\/$/, ''));	
	})
	.use(function *(next){
		try{
			yield next;
		}catch(e){
			this.body = {
				res:{
					status: false,
					msg: e.message,
					stack: e.stack
				}
			};
		}
	})
	.use(mount('/system', systemApi))
};

var mountSystemApi = () => {

	file.recurse('./product/server/process/api/system/', (abspath, rootdir, subdir, filename)=>{
		if ( !/\.js$/.test(filename) ) return;
			let fn = require(`./system/${filename}`);
		if ( _.isFunction(fn) ) {
			fn(systemRouter);
		} else {
			console.log(`[warning] can\'t load system api : ${filename}`);
		}
	});

	systemApi
	.use(systemRouter.routes())
	.use(systemRouter.allowedMethods());

};

// ================================================================================
// Socket / server
// ================================================================================
Promise.resolve()
.then(() => msg.spawnSocket('api', pmid, {}))
.then(() => {
	mountSystemApi();
	apiServer();
})
.catch((err) => console.log(`[error] ${err.message}\n${err.stack}`));
