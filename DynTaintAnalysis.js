//todo: --------------nodejs
const Utils = new (require("./Utils").Utils)();
const Log = new (require("./Log").Log)();
const assert = require("assert");
//----------nodejs

var config = new (function ()
{
	this.ifTaintNaN = true;
})();





(function (sandbox)
{
function TaintAnalysis(rule)
{
	function AnnotatedValue(val, shadow)
	{
		this.val = val;
		this.shadow = shadow;
	}
	function actual(val)
	{
		return val instanceof AnnotatedValue ? val.val : val;
	}
	function shadow(val)
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
				ret[i] = rule.noTaint;
			}
			return ret;
		}
		else if (typeof val === 'number')
		{
			return rule.noTaint;
		}
		return rule.noTaint;//todo???
	}

	function assertTaint(val, taint, position)
	{
		function myAssert(b)
		{
			if (!b)
			{
				process.stdout.write("Assertion failure at" + position);
				assert(false);
			}
		}
		var s = shadow(val, rule.noTaint);
		myAssert(typeof s === typeof taint);
		if (Array.isArray(s))
		{
			myAssert(s.length === taint.length);
			for (var i = 0; i < s.length; i++)
			{
				myAssert(s[i] === taint[i]);
			}
		}
		else
		{
			myAssert(s === taint);
		}
	}

	const numAddTypes = new Set(['undefined', 'boolean', 'number']);
	const isNumAddOperands = (val) => numAddTypes.has(typeof val) || val === null;
	/*undefined and null in array will not be shown
	when they are in array,
	and array is converted to string*/
	const isSolidStrInArr = (val, outArrs) => typeof val != 'undefined'
		&& val !== null && outArrs.indexOf(val) === -1;

	function getTaintArrayForArray(arr, outArrs)
	{//pre: Array.isArray(aval)
		if (arr.length === 0)
			return [];
		outArrs.push(arr);
		var ret = [];
		for (var i = 0; i < arr.length - 1; i++)
		{//iterate except for last element
			if (isSolidStrInArr(actual(arr[i]), outArrs))
			{
				ret = ret.concat(getTaintArrayH(arr[i], outArrs));
			}
			ret = ret.concat(false);//',' is not tainted
		}
		if (isSolidStrInArr(actual(arr[i]), outArrs))
		{
			ret = ret.concat(getTaintArrayH(arr[i], outArrs));
		}
		//Utils.assert(ret.length === (''+arr).length);
		//cannot be true due to AnnotatedValue Object
		outArrs.pop();
		return ret;
	}
	function getTaintArrayH(val, outArrs)
	{//get the taint array when `val` is converted to string
		var aval = actual(val);
		switch(typeof aval)
		{
			case 'string':
				return shadow(val, rule.noTaint);
			case 'object':
			{
				if (Array.isArray(aval))
					return getTaintArrayForArray(aval, outArrs);
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

	function getTaintArray(val)
	{
		return getTaintArrayH(val, []);
	}

	function addTaintProp(left, right, result, op)
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

	const numChar = new Set("0123456789xXabcdefABCDEF.-InfinityNaN");
	function alwaysGiveNaNStr(v, s)
	{//pre: s is string
		var tmp = "";
		for (var i = 0; i < v.length; i++)
		{
			if (s[i] !== rule.noTaint)
			{//if tainted, try to convert to number
				tmp += '0';
			}
			else if (!numChar.has(v[i]))
			{//if not in standard numChar, must be NaN
				return true;
			}
			else
			{//if it is standard, leave it
				tmp += v[i];
			}
		}
		return isNaN(Number(tmp));
	}

	const numArithTypes = new Set(['boolean', 'number']);
	function alwaysGiveNaN(rawVal)
	{
		var val = actual(rawVal);
		var s = shadow(rawVal, rule.noTaint);
		var t = typeof val;
		var b = (t === 'string') && alwaysGiveNaNStr(val, s);
		/*if (b || rule.isTainted(s))
			Log.log("Tainted String is producing NaN, " +
				"assuming result to be untainted, " +
				"change the input to number for higher accuracy");*/
		return (t === 'object' && val !== null &&
			alwaysGiveNaNStr(''+val, rule.toStringTaint(val, s), rule)) ||
			t === 'undefined' || b || (t === 'number' && isNaN(val));
	}
//string that will always produce NaN

	function arithTaintProp(left, right, result, op)
	{
		if (alwaysGiveNaN(left) ||
			alwaysGiveNaN(right))
		{
			return result;//no taint
		}
		else
		{//might still be false positive if s == 'true'
			var taint_state = rule.arithmetic(
				rule.compressTaint(shadow(left, rule.noTaint)),
				rule.compressTaint(shadow(right, rule.noTaint)));

			process.stdout.write(actual(left) + ' ' + op + ' ' +
				actual(right) + ' = ' + result + '; ');
			process.stdout.write(shadow(left, rule.noTaint) + ' ' + op + ' ' +
				shadow(right, rule.noTaint) + ' = ' + taint_state + '\n');

			return new AnnotatedValue(result, taint_state);
		}
	}

	function isTaintAsNum(val)
	{
		if (alwaysGiveNaN(val))
			return false;
		return rule.isTainted(shadow(val));
	}

	const isZeroInBitOper = (v) =>
		v === null || alwaysGiveNaN(v) ||
		(typeof v == "number" && (isNaN(v) || v === 0));

	function shiftTaintProp(left, right, result, op)
	{
		if (isZeroInBitOper(left))
		{//if LHS is always NaN, result is always 0
			return result;
		}
		else
		{//might still be false positive if s == 'true'
			var taint_state = rule.arithmetic(
				rule.compressTaint(shadow(left, rule.noTaint)),
				rule.compressTaint(shadow(right, rule.noTaint)));

			process.stdout.write(actual(left) + ' ' + op + ' ' +
				actual(right) + ' = ' + result + '; ');
			process.stdout.write(shadow(left, rule.noTaint) + ' ' + op + ' ' +
				shadow(right, rule.noTaint) + ' = ' + taint_state + '\n');

			return new AnnotatedValue(result, taint_state);
		}
	}

	function cmpTaintProp(left, right, result, op)
	{//todo, consider more cases to improve accuracy
		var taint_state = rule.arithmetic(
			rule.compressTaint(shadow(left, rule.noTaint)),
			rule.compressTaint(shadow(right, rule.noTaint)));

		process.stdout.write(actual(left) + ' ' + op + ' ' +
			actual(right) + ' = ' + result + '; ');
		process.stdout.write(shadow(left, rule.noTaint) + ' ' + op + ' ' +
			shadow(right, rule.noTaint) + ' = ' + taint_state + '\n');

		return new AnnotatedValue(result, taint_state);
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

	function taintAllH(val, outArrs)
	{
		if (typeof val == 'object')
		{//todo: should we change strategy
			ret = Array.isArray(val) ? [] : {};
			for (var k in val)
			{
				taintAllH(val[k]);
			}
		}
	}
	function stripTaintsH(val, outArrs)
	{
		var aval = actual(val);

		if (typeof aval == 'object')
		{
			assert(aval === val);
			outArrs.push(aval);
			var taints = {};
			for (var k in aval)
			{
				if (outArrs.indexOf(val[k]) === -1)
				{
					var stripped = stripTaintsH(val[k], outArrs)
					taints[k] = stripped.taints;
					val[k] = stripped.values;
				}
			}
			outArrs.pop();
			return {taints:taints, values:val};
		}
		else
		{
			return {taints:shadow(val), values:actual(val)};
		}
	}

	function stripTaints(val)
	{
		return stripTaintsH(val, []);
	}

	function isTainted(taint)
	{
		if (Array.isArray(taint))
		{
			for (var i = 0; i < taint.length; i++)
			{
				if (taint[i] !== rule.noTaint)
					return true;
			}
			return false;
		}
		else
		{
			return taint !== rule.noTaint;
		}
	}

	function mergeTaintsH(val, taints)
	{//pre: val and taints come from stripTaints function
		for (var k in taints)
		{
			if (typeof taints[k] == 'object' && !Array.isArray(taints[k]))
			{
				val[k] = mergeTaintsH(val[k], taints[k]);
			}
			else if (isTainted(taints[k]))
			{
				val[k] = new AnnotatedValue(val[k], taints[k]);
			}
		}
		return val;
	}

	function mergeTaints(val, taints)
	{
		if (typeof taints == 'object' && !Array.isArray(taints))
		{
			return mergeTaintsH(val, taints)
		}
		else if (isTainted(taints))
		{
			return new AnnotatedValue(val, taints);
		}
		else
		{
			return val;
		}
	}

	function andTaintProp(left, right, result, op)
	{
		if (isZeroInBitOper(left) ||
			isZeroInBitOper(right))
		{
			return result;
		}
		else
		{
			var taint_state = rule.arithmetic(
				rule.compressTaint(shadow(left, rule.noTaint)),
				rule.compressTaint(shadow(right, rule.noTaint)));

			process.stdout.write(actual(left) + ' ' + op + ' ' +
				actual(right) + ' = ' + result + '; ');
			process.stdout.write(shadow(left, rule.noTaint) + ' ' + op + ' ' +
				shadow(right, rule.noTaint) + ' = ' + taint_state + '\n');

			return new AnnotatedValue(result, taint_state);
		}
	}
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
			ret = {result: arithTaintProp(left, right, result, rule, op)};
			break;
		case "*":
			result = aleft * aright;
			ret = {result: arithTaintProp(left, right, result, rule, op)};
			break;
		case "/":
			result = aleft / aright;
			ret = {result: arithTaintProp(left, right, result, rule, op)};
			break;
		case "%":
			result = aleft % aright;
			ret = {result: arithTaintProp(left, right, result, rule, op)};
			break;
		case "<<":
			result = aleft << aright;
			ret = {result: shiftTaintProp(left, right, result, rule, op)};
			break;
		case ">>":
			result = aleft >> aright;
			ret = {result: shiftTaintProp(left, right, result, rule, op)};
			break;
		case ">>>":
			result = aleft >>> aright;
			ret = {result: shiftTaintProp(left, right, result, rule, op)};
			break;
		case "<":
			result = aleft < aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case ">":
			result = aleft > aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "<=":
			result = aleft <= aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case ">=":
			result = aleft >= aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "==":
			result = aleft == aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "!=":
			result = aleft != aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "===":
			result = aleft === aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "!==":
			result = aleft !== aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "&":
			result = aleft & aright;//todo: imprive accracy
			ret = {result: andTaintProp(left, right, result, rule, op)};
			break;
		case "|":
			result = aleft | aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "^":
			result = aleft ^ aright;
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "delete":
			result = delete aleft[aright];
			ret = {result: result};
			break;
		case "instanceof":
			result = aleft instanceof aright;
			ret = {result: result};
			break;
		case "in":
			result = aleft in aright;
			ret = {result: result};
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
		if (typeof val === 'string')
		{
			if (val.substr(0, 11) === "ta1nt3d_int")
			{
				return {
					result: new AnnotatedValue(
						Number(val.substr(11)), rule.fullTaint)
				};
			}
			else if (val.substr(0, 14) === "ta1nt3d_string")
			{
				var ret = val.substr(14);
				var taint = Utils.fillArray(rule.fullTaint, ret.length);
				return {result: new AnnotatedValue(ret, taint)};
			}
			else if (val === "ta1nt3d_bool")
			{
				return {result: new AnnotatedValue(true, rule.fullTaint)};
			}
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
		//todo: to remove, for test only
		if (f === 'assertTaint')
		{
			assertTaint(args[0], args[1],
				(sandbox.iidToLocation(sandbox.getGlobalIID(iid))));
			return {result : undefined};
		}
		if (Utils.isNative(f))
		{
			//convert arguments to actual value
			var strippedBase = base === global ? base : stripTaints(base);
			var strippedArgs = stripTaints(args);
			var aargs = strippedArgs.values;
			var abase = strippedBase.values;
			var ret = f.apply(abase, aargs);

			base = base === global ? base : mergeTaints(abase, strippedBase.taints);
			var sv;
			if (f === String.prototype.substr && typeof abase == 'string')
			{//todo: what if index and size are tainted?
				sv = getTaintArray(base).slice(aargs[0], aargs[0] + aargs[1]);
				args = mergeTaints(aargs, strippedArgs.taints);
			}
			if (f === Number)
			{
				args = mergeTaints(aargs, strippedArgs.taints);
				if (!alwaysGiveNaN(args[0], rule))
				{
					sv = rule.compressTaint(shadow(args[0], rule.noTaint));
				}
			}
			//todo: process other type of native function
			process.stdout.write("sv " + JSON.stringify(sv));
			if (sv)
				return {result:new AnnotatedValue(ret, sv)};
			else
				return {result:ret};
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
		process.stdout.write((base) + ' ' + offset + '\n');
		return {base:actual(base), offset:actual(offset)};
	};
}
sandbox.analysis = new TaintAnalysis(new (require("./TaintLogic").TaintUnit)());
})(J$);