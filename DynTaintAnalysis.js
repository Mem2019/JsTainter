//todo: --------------nodejs
const Utils = new (require("./Utils").Utils)();
const assert = require("assert");
const Log = new (require("./Log").Log)();
//----------nodejs

var config = new (function ()
{
	this.ifTaintNaN = true;
	this.ifTaintResWhenKeyTaint = false;
	this.ifTaintElemWhenKeyTaint = false;
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

	function myAssert(b, position)
	{
		if (b !== true)
		{
			Log.log("Assertion failure at" + position);
			assert(false);
		}
	}
	function assertTaint(val, taint, position)
	{
		var s = shadow(val, rule.noTaint);
		myAssert(typeof s === typeof taint, position);
		if (Array.isArray(s))
		{
			myAssert(s.length === taint.length, position);
			for (var i = 0; i < s.length; i++)
			{
				myAssert(s[i] === taint[i], position);
			}
		}
		else
		{
			myAssert(s === taint, position);
		}
	}

	const numAddTypes = new Set(['undefined', 'boolean', 'number']);
	const isNumAddOperands = (val) => numAddTypes.has(typeof val) || val === null;
	/*undefined and null in array will not be shown
	when they are in array,
	and array is converted to string*/
	const isSolidStrInArr = (val, outArrs) => typeof val != 'undefined'
		&& val !== null && outArrs.indexOf(val) === -1;




	function getTaintArray(val)
	{
		function getTaintArrayH(val, outArrs)
		{//get the taint array when `val` is converted to string
			var aval = actual(val);
			switch (typeof aval)
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
		return getTaintArrayH(val, []);
	}

	function isUntainted(taint)
	{
		return !isTainted(taint);
	}

	function stringConcatProp(left, right, result)
	{
		var newTaint = getTaintArray(left, rule).
		concat(getTaintArray(right, rule));
		if (isUntainted(newTaint))
			return result;
		else
			return new AnnotatedValue(result, newTaint);
	}

	function addTaintProp(left, right, result, op)
	{
		if (isNumAddOperands(actual(left)) &&
			isNumAddOperands(actual(right)))
		{//numeric add
			var taint_state = rule.arithmetic(
				shadow(left, rule.noTaint),
				shadow(right, rule.noTaint), op);

			Log.log(actual(left) + ' ' + op + ' ' +
				actual(right) + ' = ' + result + '; ');
			Log.log(shadow(left, rule.noTaint) + ' ' + op + ' ' +
				shadow(right, rule.noTaint) + ' = ' + taint_state + '\n');

			return new AnnotatedValue(result, taint_state);
		}
		else //if (typeof actual(left) === "string" &&
		//typeof actual(right) === "string")
		{//string concatenation
			return stringConcatProp(left, right, result);
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
		return (t === 'object' && val !== null &&
			alwaysGiveNaNStr(''+val, rule.toStringTaint(val, s), rule)) ||
			t === 'undefined' || b || (t === 'number' && isNaN(val) && isUntainted(s));
	}
//string that will always produce NaN

	function binaryTaintProp(callback, left, right, result, op)
	{
		if (callback(left, right))
		{
			return result;
		}
		else
		{
			var taint_state = rule.arithmetic(
				rule.compressTaint(shadow(left, rule.noTaint)),
				rule.compressTaint(shadow(right, rule.noTaint)));

			Log.log(actual(left) + ' ' + op + ' ' +
				actual(right) + ' = ' + result + '; ');
			Log.log(shadow(left, rule.noTaint) + ' ' + op + ' ' +
				shadow(right, rule.noTaint) + ' = ' + taint_state + '\n');

			if (taint_state !== rule.noTaint)
				return new AnnotatedValue(result, taint_state);
			else
				return result;
		}
	}

	function arithTaintProp(left, right, result, op)
	{
		return binaryTaintProp((left, right) =>
			alwaysGiveNaN(left) || alwaysGiveNaN(right),
			left, right, result, op);
	}

	function isTaintAsNum(val)
	{
		if (alwaysGiveNaN(val))
			return false;
		return rule.isTainted(shadow(val));
	}

	const isZeroInOper = (v) =>
		v === null || alwaysGiveNaN(v) ||
		(typeof v == "number" && (isNaN(v) || v === 0));




	function shiftTaintProp(left, right, result, op)
	{
		//if LHS is always NaN, result is always 0
		return binaryTaintProp((left) => isZeroInOper(left), left, right, result, op);
	}

	function cmpTaintProp(left, right, result, op)
	{//todo, consider more cases to improve accuracy
		return binaryTaintProp(()=>false, left, right, result, op);
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
					var stripped = stripTaintsH(val[k], outArrs);
					if (stripped.taints !== rule.noTaint)
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

	function getTaintResult(result, taint)
	{
		if (taint === rule.noTaint || typeof taint == 'undefined')
			return result;
		else
			return new AnnotatedValue(result, taint);
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

	function taintArrToStr(taints)
	{//todo: max string len supported is 65535
		var s = "";
		assert(taints.length <= 0x10000);
		for (var i = 0; i < taints.length; i++)
		{
			s += String.fromCharCode(i);
		}
		return s;
	}
	function strToTaintArr(s, taints)
	{
		var retSlice = [];
		for (var i = 0; i < s.length; i++)
		{
			retSlice = retSlice.concat(taints[s.charCodeAt(i)]);
		}
		return retSlice;
	}

	function andTaintProp(left, right, result, op)
	{
		if (isZeroInOper(left) ||
			isZeroInOper(right))
		{
			return result;
		}
		else
		{
			var taint_state = rule.arithmetic(
				rule.compressTaint(shadow(left, rule.noTaint)),
				rule.compressTaint(shadow(right, rule.noTaint)));

			Log.log(actual(left) + ' ' + op + ' ' +
				actual(right) + ' = ' + result + '; ');
			Log.log(shadow(left, rule.noTaint) + ' ' + op + ' ' +
				shadow(right, rule.noTaint) + ' = ' + taint_state + '\n');

			return getTaintResult(result, taint_state);
		}
	}
	this.taintProp = {};
	this.binaryPre = function(iid, op, left, right)
	{
		return {op:op,left:left,right:right,skip:true}
	};
	this.binary = function(iid, op, left, right, result)
	{
		binaryRec(left, right, this.taintProp, sandbox, iid);
		var ret;
		var strippedLeft = stripTaints(left);
		var strippedRight = stripTaints(right);

		var aleft = strippedLeft.values;
		var aright = strippedRight.values;
		switch (op)
		{
		case "+":
			result = aleft + aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: addTaintProp(left, right, result, rule, op)};
			break;
		case "-":
			result = aleft - aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: arithTaintProp(left, right, result, rule, op)};
			break;
		case "*":
			result = aleft * aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: arithTaintProp(left, right, result, rule, op)};
			break;
		case "/":
			result = aleft / aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: arithTaintProp(left, right, result, rule, op)};
			break;
		case "%":
			result = aleft % aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: arithTaintProp(left, right, result, rule, op)};
			break;
		case "<<":
			result = aleft << aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: shiftTaintProp(left, right, result, rule, op)};
			break;
		case ">>":
			result = aleft >> aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: shiftTaintProp(left, right, result, rule, op)};
			break;
		case ">>>":
			result = aleft >>> aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: shiftTaintProp(left, right, result, rule, op)};
			break;
		case "<":
			result = aleft < aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case ">":
			result = aleft > aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "<=":
			result = aleft <= aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case ">=":
			result = aleft >= aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "==":
			result = aleft == aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "!=":
			result = aleft != aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "===":
			result = aleft === aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "!==":
			result = aleft !== aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "&":
			result = aleft & aright;//todo: imprive accracy
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: andTaintProp(left, right, result, rule, op)};
			break;
		case "|":
			result = aleft | aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "^":
			result = aleft ^ aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: cmpTaintProp(left, right, result, rule, op)};
			break;
		case "delete":
			result = delete aleft[aright];
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: result};
			break;
		case "instanceof":
			result = aleft instanceof aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
			ret = {result: result};
			break;
		case "in":
			result = aleft in aright;
			left = mergeTaints(aleft, strippedLeft.taints);
			right = mergeTaints(aright, strippedRight.taints);
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
			//Log.log(''+val)
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
		Log.log(JSON.stringify(this.taintProp) + '\n')
	};
	this.invokeFunPre = function(iid, f, base, args, isConstructor, isMethod)
	{
		return {f:f, base:base, args:args, skip:true}
	};
	this.invokeFun = function(iid, f, base, args, result, isConstructor, isMethod)
	{
		const charAtTaint = (ts, idx) =>
			strToTaintArr(taintArrToStr(ts).charAt(idx), ts);
		//todo: to remove, for test only
		if (f === 'assertTaint')
		{
			assertTaint(args[0], args[1],
				(sandbox.iidToLocation(sandbox.getGlobalIID(iid))));
			return {result : undefined};
		}
		else if (f === "assert")
		{
			myAssert(actual(args[0]),
				(sandbox.iidToLocation(sandbox.getGlobalIID(iid))));
			return {result : undefined};
		}
		else if (f === "debug")
		{
			Log.log("debug");
			return {result : undefined};
		}
		if (Utils.isNative(f))
		{
			var strippedArgs, strippedBase;
			var aargs, abase;
			var sv, ret, taints;
			switch (f)
			{
			case Function.prototype.apply:
			{
				return this.invokeFun(iid, base, args[0], args[1],
					result, isConstructor, isMethod);
			}
			case String.prototype.substr:
			{//todo: what if index and size are tainted?
				//todo: maybe there is better way
				strippedBase = stripTaints(base);
				strippedArgs = stripTaints(args);
				aargs = strippedArgs.values;
				abase = strippedBase.values;
				ret = f.apply(abase, aargs);
				base = mergeTaints(abase, strippedBase.taints);
				const sliceTaint = (ts, idx, len) =>
					strToTaintArr(taintArrToStr(ts).
					substr(idx, len), ts);
				sv = sliceTaint(getTaintArray(base), aargs[0], aargs[1]);
				args = mergeTaints(aargs, strippedArgs.taints);
			}
			break;
			case Number:
			{
				if (!alwaysGiveNaN(args[0], rule))
				{
					sv = rule.compressTaint(shadow(args[0], rule.noTaint));
				}
				strippedArgs = stripTaints(args);
				aargs = strippedArgs.values;
				ret = f.apply(base, aargs);
				args = mergeTaints(aargs, strippedArgs.taints);
			}
			break;
			case String.prototype.charAt:
			{
				strippedBase = stripTaints(base);
				strippedArgs = stripTaints(args);
				aargs = strippedArgs.values;
				abase = strippedBase.values;
				ret = f.apply(abase, aargs);
				base = mergeTaints(abase, strippedBase.taints);
				sv = charAtTaint(getTaintArray(base), aargs[0]);
				//todo: what if index is tainted
				args = mergeTaints(aargs, strippedArgs.taints);
			}
			break;
			case String.prototype.charCodeAt:
			{
				strippedBase = stripTaints(base);
				strippedArgs = stripTaints(args);
				aargs = strippedArgs.values;
				abase = strippedBase.values;
				ret = f.apply(abase, aargs);
				base = mergeTaints(abase, strippedBase.taints);

				sv = rule.ordTaint(charAtTaint(getTaintArray(base), aargs[0]));
				//when taint array length == 0, sv == undefined, which gives no taint
				//todo: what if index is tainted
				args = mergeTaints(aargs, strippedArgs.taints);
			}
			break;
			case String.fromCharCode:
			{
				if (!isZeroInOper(args[0]))
				{
					sv = rule.chrTaint(rule.compressTaint(
						shadow(args[0], rule.noTaint)));
				}
				strippedArgs = stripTaints(args);
				aargs = strippedArgs.values;
				ret = f.apply(base, aargs);
				args = mergeTaints(aargs, strippedArgs.taints);
			}
			break;
			case String.prototype.concat:
			{
				strippedBase = stripTaints(base);
				strippedArgs = stripTaints(args);
				aargs = strippedArgs.values;
				abase = strippedBase.values;
				ret = f.apply(abase, aargs);
				args = mergeTaints(aargs, strippedArgs.taints);
				base = mergeTaints(abase, strippedBase.taints);
				sv = Array.prototype.concat.apply(
					getTaintArray(base, rule),
					Array.prototype.map.call(args,(a) => getTaintArray(a, rule)));
			}
			break;
			case String.prototype.endsWith:
			{
				//todo
				taints = getTaintArray(base);
				t = taints[taints.length - 1];

			}
			break;
			case escape:
			{
				taints = getTaintArray(args[0]);
				strippedBase = stripTaints(args[0]);
				abase = strippedBase.values;
				ret = f.apply(base, [abase]);
				sv = [];
				var j = 0;
				for (var i = 0; i < taints.length; i++)
				{
					if (ret[j] === '%')
					{
						var k;
						if (ret[j + 1] === 'u')
						{
							for (k = 0; k < 6; k++)
							{
								sv = sv.concat(rule.escapeTaint(taints[i]));
							}
							j += 6;
						}
						else
						{//hex
							for (k = 0; k < 3; k++)
							{
								sv.concat(rule.escapeTaint(taints[i]));
							}
							j += 3;
						}
					}
					else
					{
						sv.concat(rule.escapeTaint(taints[i]));
						++j;
					}
				}
			}
			break;
			case Number.prototype.toString:
			{//base must be number, otherwise exception will be thrown
				abase = actual(base);
				if (!(abase instanceof Number) && typeof abase !== 'number')
					throw TypeError("Number.prototype.toString is not generic");
				strippedArgs = stripTaints(args);
				aargs = strippedArgs.values;

				rule.toStringTaint(base, shadow(base), (a) => f.apply(a, aargs));
				args = mergeTaints(aargs, strippedArgs.taints);
			}
			break;
			case Array.prototype.push:
			{
				ret = f.apply(base, args);
			}
			break;
			default:
			{
				strippedBase = stripTaints(base);
				strippedArgs = stripTaints(args);
				aargs = strippedArgs.values;
				abase = strippedBase.values;
				ret = f.apply(abase, aargs);
				args = mergeTaints(aargs, strippedArgs.taints);
				base = mergeTaints(abase, strippedBase.taints);
			}
			break;
			}
			//convert arguments to actual value

			//todo: process other type of native function
			Log.log("sv " + JSON.stringify(sv));
			if (typeof sv !== 'undefined' && isTainted(sv))
				return {result:new AnnotatedValue(ret, sv)};
			else
				return {result:ret};
		}
		else
		{
			//Log.log('--------'+actual(base));
			//if (isConstructor)'
			function newInstance(constructor, args)
			{//https://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
				var Temp = function(){}, // temporary constructor
					inst; // other vars
				// Give the Temp constructor the Constructor's prototype
				Temp.prototype = constructor.prototype;
				// Create a new instance
				inst = new Temp;
				// Call the original Constructor with the temp
				// instance as its context (i.e. its 'this' value)
				ret = constructor.apply(inst, args);
				// If an object has been returned then return it otherwise
				// return the original instance.
				// (consistent with behaviour of the new operator)
				return Object(ret) === ret ? ret : inst;
			}
			if (isConstructor)
			{
				return {result:newInstance(f, args)};
			}
			else
			{
				return {result:f.apply(base, args)};
			}

		}
	};
	this.getFieldPre = function(iid, base, offset)
	{
		return {base:base, offset:offset, skip:true};
	};
	this.getField = function (iid, base, offset)
	{
		var abase = actual(base);
		var strippedOff = stripTaints(offset);
		var sbase = shadow(base);
		var ret;
		if (typeof abase == "string"
			&& Number.isInteger(strippedOff.values)
			&& strippedOff.values < sbase.length)
		{//is accessing string character
			var elemT = sbase[strippedOff.values];
			ret = abase[strippedOff.values];
			var sv = rule.getStringCharTaint(elemT, strippedOff.taints);
			mergeTaints(strippedOff.values, strippedOff.taints);
			return getTaintResult(ret, sv);
		}
		else
		{
			ret = abase[strippedOff.values];
			offset = mergeTaints(strippedOff.values, strippedOff.taints);
			ret = rule.getFieldTaint(ret, shadow(offset));
			return {result: ret};
		}
	};
	this.putFieldPre = function (iid, base, offset, val)
	{
		return {base:base, offset:offset, val:val, skip:true};
	};
	this.putField = function (iid, base, offset, val)
	{
		var abase = actual(base);
		var strippedOff = stripTaints(offset);
		abase[strippedOff.values] = val;//todo, when offset tainted?
		mergeTaints(strippedOff.values, strippedOff.taints);
		return {result:val};
	};
}
sandbox.analysis = new TaintAnalysis(new (require("./TaintLogic").TaintUnit)(config));
})(J$);