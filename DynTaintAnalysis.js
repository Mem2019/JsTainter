//todo: --------------nodejs
const Utils = new (require("./Utils").Utils)();
//----------nodejs

var config = new (function ()
{
	this.ifTaintNaN = true;
})();


function AnnotatedValue(val, shadow)
{
	this.val = val;
	this.shadow = shadow;
}
function actual(val)
{
	return val instanceof AnnotatedValue ? val.val : val;
}
function shadow(val, noTaint)
{
	if (val instanceof AnnotatedValue)
	{
		return val.shadow;
	}
	else if (typeof val === 'string')
	{
		var ret = [];//todo, optimize to logn
		for (var i = 0; i < val.length; i++)
		{
			ret[i] = noTaint;
		}
		return ret;
	}
	else if (typeof val === 'number')
	{
		return noTaint;
	}
	return noTaint;//todo???
}

const numAddTypes = new Set(['undefined', 'boolean', 'number']);
const isNumAddOperands = (val) => numAddTypes.has(typeof val) || val === null;
/*undefined and null in array will not be shown
when they are in array,
and array is converted to string*/
const isSolidStrInArr = (val) => typeof val != 'undefined' || val === null;

function getTaintArrayForArray(arr, rule)
{//pre: Array.isArray(aval)
	if (arr.length === 0)
		return [];
	var ret = [];
	for (var i = 0; i < arr.length - 1; i++)
	{//iterate except for last element
		if (isSolidStrInArr(arr[i]))
		{
			ret = ret.concat(getTaintArray(arr[i], rule));
		}
		ret = ret.concat(false);//',' is not tainted
	}
	if (isSolidStrInArr(arr[i]))
	{
		ret = ret.concat(getTaintArray(arr[i], rule));
	}
	//Utils.assert(ret.length === (''+arr).length);
	//cannot be true due to AnnotatedValue Object
	return ret;
}
function getTaintArray(val, rule)
{//get the taint array when `val` is converted to string
	var aval = actual(val);
	switch(typeof aval)
	{
		case 'string':
			return shadow(val, rule.noTaint);
		case 'object':
		{
			if (Array.isArray(aval))
				return getTaintArrayForArray(aval, rule);
			else //this includes the case where aval === null
				return Utils.fillArray(rule.noTaint, ('' + aval).length)
		}
		case 'number':
		case 'boolean':
		case 'undefined':
		{
			return rule.toStringTaint(aval, shadow(val, rule.noTaint));
		}
		default:
			throw Error("Currently does not support type \'" + typeof val + "\' for add");
	}
}

function addTaintProp(left, right, result, rule, op)
{
	if (isNumAddOperands(actual(left)) &&
		isNumAddOperands(actual(right)))
	{//numeric add
		var taint_state = rule.arithmetic(
			shadow(left, rule.noTaint), shadow(right, rule.noTaint));

		process.stdout.write(actual(left) + ' ' + op + ' ' +
			actual(right) + ' = ' + result + '; ');
		process.stdout.write(shadow(left, rule.noTaint) + ' ' + op + ' ' +
			shadow(right, rule.noTaint) + ' = ' + taint_state + '\n');

		return new AnnotatedValue(result, taint_state);
	}
	else //if (typeof actual(left) === "string" &&
		//typeof actual(right) === "string")
	{//string concatenation
		return new AnnotatedValue(actual(left) + actual(right),
			getTaintArray(left, rule).concat(getTaintArray(right, rule)));
	}
}


function binaryRec(left, right, taintProp, sandbox, iid)
{//todo
	/*if (isTainted(shadow(left, noTaint)) || isTainted(shadow(right, noTaint)))
	{
		taintProp[(sandbox.iidToLocation(
			sandbox.getGlobalIID(iid)))] = 1;
	}*/
}
function funcInvokeRec(func, base, args)
{

}

function isTainted(shadow)
{
	if (typeof shadow == 'boolean')
	{
		return shadow;
	}
	else if (Array.isArray(shadow))
	{
		return shadow.reduce((a, b) => a || b);
	}
}


(function (sandbox)
{
function TaintAnalysis(rule)
{
	this.taintProp = {};
	this.binaryPre = function(iid, op, left, right)
	{
		return {op:op,left:left,right:right,skip:true}
	};
	this.binary = function(iid, op, left, right, result)
	{
		var aleft = actual(left);
		var aright = actual(right);
		binaryRec(left, right, this.taintProp, sandbox, iid);
		var ret;
		switch (op)
		{
		case "+":
			result = aleft + aright;
			ret = {result: addTaintProp(left, right, result, rule, op)};
			break;
		case "-":
			result = aleft - aright;
			break;
		case "*":
			result = aleft * aright;
			break;
		case "/":
			result = aleft / aright;
			break;
		case "%":
			result = aleft % aright;
			break;
		case "<<":
			result = aleft << aright;
			break;
		case ">>":
			result = aleft >> aright;
			break;
		case ">>>":
			result = aleft >>> aright;
			break;
		case "<":
			result = aleft < aright;
			break;
		case ">":
			result = aleft > aright;
			break;
		case "<=":
			result = aleft <= aright;
			break;
		case ">=":
			result = aleft >= aright;
			break;
		case "==":
			result = aleft == aright;
			break;
		case "!=":
			result = aleft != aright;
			break;
		case "===":
			result = aleft === aright;
			break;
		case "!==":
			result = aleft !== aright;
			break;
		case "&":
			result = aleft & aright;
			break;
		case "|":
			result = aleft | aright;
			break;
		case "^":
			result = aleft ^ aright;
			break;
		case "delete":
			result = delete aleft[aright];
			break;
		case "instanceof":
			result = aleft instanceof aright;
			break;
		case "in":
			result = aleft in aright;
			break;
		default:
			throw new Error(op + " at " + iid + " not found");
			break;
		}
		return ret;
	};
	this.literal = function (iid, val, hasGetterSetter)
	{
		if (typeof val === 'function')
		{//sandbox
			//process.stdout.write(''+val)
		}
		//functinon for testing
		if (val === "ta1nt3d_int")
		{
			return {result: new AnnotatedValue(31337, rule.fullTaint)};
		}
		else if (val === "ta1nt3d_string")
		{
			var ret = "A";
			var taint = [rule.fullTaint];
			for (var i = 0; i < 8; i++)
			{
				ret += ret;
				taint = taint.concat(taint);
			}
			return {result: new AnnotatedValue(ret, taint)};
		}
		else if (val === "ta1nt3d_bool")
		{
			return {result: new AnnotatedValue(true, rule.fullTaint)};
		}
	};
	this.endExecution = function()
	{
		process.stdout.write(JSON.stringify(this.taintProp) + '\n')
	};
	this.invokeFunPre = function(iid, f, base, args, isConstructor, isMethod)
	{
		return {f:f, base:base, args:args, skip:true}
	};
	this.invokeFun = function(iid, f, base, args, result, isConstructor, isMethod)
	{
		if (Utils.isNative(f))
		{
			//convert arguments to actual value
			var abase = actual(base);
			var aargs = [];
			for (var i = 0; i < args.length; i++)
			{
				aargs[i] = actual(args[i]);
			}
			var sv;
			if (f === String.prototype.substr && typeof abase == 'string')
			{//todo: what if index and size are tainted?
				sv = shadow(base, rule.noTaint).slice(aargs[0], aargs[0] + aargs[1]);
			}
			//todo: process other type of native function
			process.stdout.write("sv " + JSON.stringify(sv));
			if (sv)
				return {result:new AnnotatedValue(
					f.apply(abase, aargs), sv)};
			else
				return {result:f.apply(abase, aargs)};
		}
		else
		{
			//process.stdout.write('--------'+actual(base));
			//if (isConstructor)
			return {result:f.apply(base, args)};
		}
	};
	this.getFieldPre = function(iid, base, offset)
	{
		//todo, when offset is tainted
		process.stdout.write(JSON.stringify(base) + ' ' + offset + '\n');
		return {base:actual(base), offset:actual(offset)};
	};
}
sandbox.analysis = new TaintAnalysis(new (require("./TaintLogic").TaintUnit)());
})(J$);