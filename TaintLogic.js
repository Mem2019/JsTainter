//todo: --------------nodejs
const Utils = new (require("./Utils").Utils)();
//----------nodejs

function TaintUnit() {}
TaintUnit.prototype.noTaint = false;
TaintUnit.prototype.fullTaint = true;
TaintUnit.prototype.arithmetic = function(left, right)
{
	return left || right;
};
TaintUnit.prototype.toStringTaint = (a,t)=>Utils.fillArray(t, (''+a).length);
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