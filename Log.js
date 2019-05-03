function Log(){}
Log.prototype.log = function (msg)
{
	process.stdout.Write("[*] Log: " + msg + '\n');
};

//todo: ----------nodejs
module.exports = {
	Log : Log
};
//----------nodejs