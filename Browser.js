(function (sandbox) {
function Browser()
{
	var nextId = 1;
	this.getNextId = function ()
	{
		if (nextId >= 32)
			throw Error("Too many input sources");
		return nextId++; // return nextId, and increment it
	};
	var inputsArr = [];
	this.getInputId = function (input)
	{
		for (var i = 0; i < inputsArr; i++)
		{
			if (inputsArr[i].input === input)
				return inputsArr[i].id;
		}
		const nextId = this.getNextId();
		inputsArr.push({input:input, id:nextId});
		return nextId;
	};
}//todo : putField, native functions

Browser.prototype.getField = function (base, offset, config)
{
	const nt = sandbox.dtaTaintLogic.noTaint;
	const fillArr = sandbox.dtaUtils.fillArray;
	var ft = sandbox.dtaTaintLogic.taintSource;
	function getRet(val, start, ft)
	{
		if (typeof val == 'undefined')
		{
			return {ret: val, sv: config.ifTaintUndefined ? ft : nt};
		}
		else
		{
			const end = val.length;
			return {
				ret: val, sv:
					fillArr(nt, start).concat(fillArr(ft, end - start))
			};
		}
	}
	if (base === window.location)
	{
		ft = ft(0);
		switch (offset)
		{
		case "hash":
		case "search":
			return getRet(base[offset], 0, ft);
		case "pathname":
			if (config.taintPathName)
				return getRet(base[offset], 0, ft);
			else
				return {ret:val};
		case "href":
			const start = config.taintPathName ?
				base.href.indexOf(base.origin) + base.origin.length :
				base.href.indexOf('?');
			return getRet(base[offset], start, ft);
		default:
			return {ret:val};
		}
	}
	else if (String(base) === '[object HTMLInputElement]'
		&& offset === 'value' && base.type === 'text')
	{
		ft = ft(this.getInputId(base));
		return getRet(base.value, 0, ft);
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
			sv = fillArray(ft(this.getNextId()), ret.length);
			return {ret: ret, sv: sv};
		}
		else
		{
			return {ret:ret};
		}
	default:
		return;
	}

};
sandbox.dtaBrowser = new Browser();
})(J$);