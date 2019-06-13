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
Browser.prototype.invokeFunSrc = function (f, abase, args)
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
Browser.prototype.putField = function (base, offset, val, sval, config)
{
	function genMsg(c)
	{
		var ret;
		try
		{
			ret = "Tainted value " + JSON.stringify(val) +
				' ' + JSON.stringify(sval) +
				" has been written to " + c + ' ' + offset;
		}
		catch (e)
		{
			ret = "Tainted value has been written to " +
				c + ' ' + offset;
		}
		return ret;
	}
	switch (base)
	{
	case window.location:
		switch (offset)
		{
		case 'hash':
		case 'host':
		case 'hostname':
		case 'href':
		case 'origin':
		case 'pathname':
		case 'port':
		case 'protocol':
		case 'search':
			return {msg: genMsg("window.location.")};
		}
		return;
	case document:
		if (offset === 'cookie')
			return {msg: genMsg("cookie.")};
		return;
	}
	const m = String(base).match(/\[object HTML[a-zA-Z0-9]+Element]/);
	if (m !== null && m[0] === String(base))
	{
		return {msg: genMsg(String(base))};
	}
};

Browser.prototype.invokeFunSnk = function (f, abase, aargs, sbase ,sargs, isTainted)
{
	function genMsg()
	{
		var ret;
		try
		{
			ret = "Tainted value " + JSON.stringify(aargs) + ' '
				+ JSON.stringify(sargs)+
				" has been passed to " + f.name;
		}
		catch (e)
		{
			ret = "Tainted value has been written to " + f.name;
		}
		return ret;
	}
	switch (f)
	{
	case document.write:
	case document.writeln:
	case XMLHttpRequest.prototype.send:
		if (sargs.map(isTainted).reduce((a,b) => a || b))
			return {msg: genMsg()};
	}
};
sandbox.dtaBrowser = new Browser();
})(J$);