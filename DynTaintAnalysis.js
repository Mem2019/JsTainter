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

	function myAssert(b, position)
	{
		if (b !== true)
		{
			process.stdout.write("Assertion failure at" + position);
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

	const isZeroInOper = (v) =>
		v === null || alwaysGiveNaN(v) ||
		(typeof v == "number" && (isNaN(v) || v === 0));

	function shiftTaintProp(left, right, result, op)
	{
		if (isZeroInOper(left))
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
		const charAtTaint = (taints, idx) =>
			strToTaintArr(taintArrToStr(taints).charAt(idx),
				taints);
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
		if (Utils.isNative(f))
		{
			var strippedArgs, strippedBase, aargs, abase, sv, ret;
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
				const sliceTaint = (taints, idx, len) =>
					strToTaintArr(taintArrToStr(taints).
					substr(idx, len), taints);
				sv = sliceTaint(getTaintArray(base), aargs[0], aargs[1]);
				args = mergeTaints(aargs, strippedArgs.taints);
			}
			break;
			case global.Number:
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
				ret = actual(base) + actual(args[0]);
				sv = getTaintArray(base, rule).
						concat(getTaintArray(args[0], rule));

			}
			break;
			}
			//convert arguments to actual value

			//todo: process other type of native function
			process.stdout.write("sv " + JSON.stringify(sv));
			if (typeof sv !== 'undefined' && isTainted(sv))
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