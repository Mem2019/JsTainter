(function (sandbox) {
function Browser(){}
Browser.prototype.getField = function (base, offset)
{
	if (base === window.location)
	{
		switch (offset)
		{
		case "hash":
		case "search":
			return sandbox.dtaUtils.fillArray(
					sandbox.dtaTaintLogic.fullTaint,
					base[offset].length);
		//todo: case "href":
		}
	}
};
Browser.prototype.invokeFun = function (f, abase, args)
{
	var ret,sv;
	const ft = sandbox.dtaTaintLogic.fullTaint;
	const fillArray = sandbox.dtaUtils.fillArray;
	switch (f)
	{
	case prompt:
		ret = f.apply(abase, args);
		if (typeof ret == 'string')
		{
			sv = fillArray(ft, ret.length);
			return {ret: ret, sv: sv};
		}
		else
		{
			return {ret:ret, sv:undefined};
		}
	default:
		return;
	}

};
sandbox.dtaBrowser = new Browser();
})(J$);