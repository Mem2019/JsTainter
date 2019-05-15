//todo: --------------nodejs
const Utils = new (require("./Utils").Utils)();
const Log = new (require("./Log").Log)();
//----------nodejs

function TaintUnit(config)
{
	this.config = config;
}
TaintUnit.prototype.noTaint = false;
TaintUnit.prototype.fullTaint = true;
TaintUnit.prototype.arithmetic = function(left, right)
{
	return left || right;
};
TaintUnit.prototype.toStringTaint = function(a,t,f)
{
	if (f !== 'undefined')
		return Utils.fillArray(t, (String(a)).length);
	else
		return Utils.fillArray(t, f(a).length);
};
TaintUnit.prototype.compressTaint = function (shadow)
{//todo, make it more generic
	if (typeof shadow == 'boolean')
	{
		return shadow;
	}
	else if (Array.isArray(shadow))
	{
		return shadow.reduce((a, b) => a || b);
	}
};
TaintUnit.prototype.ordTaint = function (t)
{
	return t[0];
};
TaintUnit.prototype.chrTaint = function (t)
{
	return [t]
};
TaintUnit.prototype.escapeTaint = function (t ,type)
{
	return t;
};
TaintUnit.prototype.getFieldTaint = function (elemT, idxT)
{//todo: maybe need to be changed for more option
	return elemT;
};

// TaintUnit.prototype.compressTaint = function(s)
// {
// 	if (Array.isArray(s))
// 	{
//
// 	}
// };


//todo, make it an array of boolean

//todo: ------------nodejs
module.exports = {
	TaintUnit : TaintUnit
};
//----------nodejs