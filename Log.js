
(function (sandbox) {

function Log(){}
Log.prototype.log = function (msg)
{
	const logStr = "[*] Log: " + msg + '\n';

	if (typeof sandbox.dtaBrowser != 'undefined')
		console.log(logStr);
	else
		process.stdout.write(logStr);
};

sandbox.dtaLog = new Log();
})(J$);
/*/: ----------nodejs
module.exports = {
	Log : Log
};
//----------nodejs*/