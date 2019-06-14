
(function (sandbox) {
	const Utils = sandbox.dtaUtils;
	function TaintUnit(config)
	{
		this.config = config;
	}
	TaintUnit.prototype.noTaint = 0;
	TaintUnit.prototype.taintSource = function (id)
	{
		return 1 << id;
	};
	TaintUnit.prototype.arithmetic = function(left, right, op, pos)
	{
		return left | right;
	};
	TaintUnit.prototype.unaryArithmetic = function(left)
	{
		return left;
	};
	TaintUnit.prototype.toStringTaint = function(a,t,f)
	{
		var ret;
		if (f !== 'undefined')
			ret = Utils.fillArray(t, (String(a)).length);
		else
			ret = Utils.fillArray(t, f(a).length);
		return ret;
	};
	TaintUnit.prototype.compressTaint = function (shadow)
	{//todo, make it more generic
		var ret;
		if (typeof shadow == 'number')
		{
			ret = shadow;
		}
		else if (Array.isArray(shadow))
		{
			if (shadow.length === 0)
				ret = false;
			else
				ret = shadow.reduce((a, b) => a | b);
		}
		return ret;
	};
	TaintUnit.prototype.ordTaint = function (t)
	{
		var ret;
		ret = t[0];
		return ret;
	};
	TaintUnit.prototype.chrTaint = function (t)
	{
		var ret;
		ret = [t];
		return ret;
	};
	TaintUnit.prototype.escapeTaint = function (t ,type)
	{
		var ret;
		ret = t;
		return ret;
	};
	TaintUnit.prototype.unescapeTaint = function (ts)
	{
		return ts.reduce((a,b) => a | b);
	};
	TaintUnit.prototype.getFieldTaint = function (elemT, idxT)
	{//todo: maybe need to be changed for more option
		var ret;
		ret = elemT;
		return ret;
	};
	TaintUnit.prototype.getStringCharTaint = function (baseT, offsetT)
	{
		var ret;
		ret = [baseT];
		return ret;
	};
	TaintUnit.prototype.strIdxOfTaint = function (baseTaintArr, argTaintArr, startIdx, end)
	{
		var ret;
		if (argTaintArr.reduce((a, b) => a | b))
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
	sandbox.dtaTaintLogic = new TaintUnit();
})(J$);
//todo, make it an array of boolean
