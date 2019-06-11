
(function (sandbox) {
	const Utils = sandbox.dtaUtils;
function TaintLogic(config)
{
	this.config = config;
}
TaintLogic.prototype.noTaint = false;
TaintLogic.prototype.taintSource = () => true;
TaintLogic.prototype.arithmetic = function(left, right, op, pos)
{
	return left || right;
};
TaintLogic.prototype.unaryArithmetic = function(left)
{
	return left;
};
TaintLogic.prototype.toStringTaint = function(a,t,f)
{
	var ret;
	if (f !== 'undefined')
		ret = Utils.fillArray(t, (String(a)).length);
	else
		ret = Utils.fillArray(t, f(a).length);
	return ret;
};
TaintLogic.prototype.compressTaint = function (shadow)
{//todo, make it more generic
	var ret;
	if (typeof shadow == 'boolean')
	{
		ret = shadow;
	}
	else if (Array.isArray(shadow))
	{
		if (shadow.length === 0)
			ret = false;
		else
			ret = shadow.reduce((a, b) => a || b);
	}
	return ret;
};
TaintLogic.prototype.ordTaint = function (t)
{
	var ret;
	ret = t[0];
	return ret;
};
TaintLogic.prototype.chrTaint = function (t)
{
	var ret;
	ret = [t];
	return ret;
};
TaintLogic.prototype.escapeTaint = function (t ,type)
{
	var ret;
	ret = t;
	return ret;
};
TaintLogic.prototype.getFieldTaint = function (elemT, idxT)
{//todo: maybe need to be changed for more option
	var ret;
	ret = elemT;
	return ret;
};
TaintLogic.prototype.getStringCharTaint = function (baseT, offsetT)
{
	var ret;
	ret = [baseT];
	return ret;
};
TaintLogic.prototype.strIdxOfTaint = function (baseTaintArr, argTaintArr, startIdx, end)
{
	var ret;
	if (argTaintArr.reduce((a, b) => a || b))
	{
		ret = true;
		return ret;
	}
	for (var i = startIdx; i <= end; i++)
	{
		if (baseTaintArr[i])
		{
			ret = true;
			return ret;
		}
	}
	ret = false;
	return ret;
};
sandbox.dtaTaintLogic = new TaintLogic();
})(J$);
//todo, make it an array of boolean
