
(function (sandbox) {

function Log(){}
Log.prototype.log = function (msg)
{
	const logStr = "[*] Log: " + msg + '\n';
	if (typeof process !== 'undefined')
		process.stdout.write(logStr);
	else if (typeof console !== 'undefined')
		console.log(logStr);
};

sandbox.dtaLog = new Log();
})(J$);
/*/: ----------nodejs
module.exports = {
	Log : Log
};
//----------nodejs*/