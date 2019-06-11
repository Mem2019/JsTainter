
(function (sandbox) {

function Log(){}
Log.prototype.log = function (msg)
{
	const logStr = "[*] Log: " + msg + '\n';
	console.log(logStr);
};

sandbox.dtaLog = new Log();
})(J$);
/*/: ----------nodejs
module.exports = {
	Log : Log
};
//----------nodejs*/