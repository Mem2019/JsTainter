(function (sandbox) {
function Browser(){}//todo : putField, native functions
Browser.prototype.getField = function (base, offset, config)
{
	const ft = sandbox.dtaTaintLogic.fullTaint;
	const nt = sandbox.dtaTaintLogic.noTaint;
	const fillArr = sandbox.dtaUtils.fillArray;
	function getRet(val, start)
	{
		const end = val.length;
		if (typeof val == 'undefined')
			return {ret: val, sv: config.ifTaintUndefined ? ft : nt};
		else
			return {ret: val, sv:
					fillArr(nt, start).
					concat(fillArr(ft, end-start))};
	}
	if (base === window.location)
	{
		switch (offset)
		{
		case "hash":
		case "search":
			return getRet(base[offset], 0);
		case "pathname":
			if (config.taintPathName)
				return getRet(base[offset], 0);
			else
				return {ret:val};
		case "href":
			const start = config.taintPathName ?
				base.href.indexOf(base.origin) + base.origin.length :
				base.href.indexOf('?');
			return getRet(base[offset], start);
		default:
			return {ret:val};
		}
	}
};
Browser.prototype.invokeFun = function (f, abase, args)
{
	var ret,sv;
	const ft = sandbox.dtaTaintLogic.taintSource;
	const fillArray = sandbox.dtaUtils.fillArray;
	switch (f)
	{
	case prompt:
		ret = f.apply(abase, args);
		if (typeof ret == 'string')
		{
			sv = fillArray(ft(1), ret.length);
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