(function (sandbox)
{
const Utils = sandbox.dtaUtils;
const Log = sandbox.dtaLog;
const config = sandbox.dtaConfig;
	const assert = function (b)
	{
		if (b === false)
			throw Error("Assertion Error");
	};




function TaintAnalysis(rule, config)
{
	this.results = [];
	const addLogRec = function(analysis, pos, msg)
	{
		assert(typeof pos.pos !== 'undefined');
		analysis.results.push(
			{type: 'log', file: pos.fname, pos: pos.pos, msg: msg});
	};
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
			return Utils.fillArray(rule.noTaint, val.length);
		}
		else if (typeof val === 'number')
		{
			return rule.noTaint;
		}
		else if (typeof val === 'object')
		{
			return {};
		}
		else
		{
			return rule.noTaint;
		}
	}

	function myAssert(b, position)
	{
		if (b !== true)
		{
			Log.log("Assertion failure at" + JSON.stringify(position));
			assert(false);
		}
	}
	function assertTaint(val, taint, position)
	{
		taint = actual(taint);
		const s = shadow(val);
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
					return Utils.fillArray(rule.noTaint, (String(aval)).length)
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
				ret = ret.concat(rule.noTaint);//',' is not tainted
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
		var mergeVal = mergeTaints(actual(val), shadow(val));
		var ret = getTaintArrayH(mergeVal, []);
		stripTaints(mergeVal);
		return ret;
	}

	const isUntainted = (taint) => !isTainted(taint);

	function stringConcatProp(left, right, result)
	{
		var newTaint = getTaintArray(left, rule).
		concat(getTaintArray(right, rule));
		if (isUntainted(newTaint))
			return result;
		else
			return new AnnotatedValue(result, newTaint);
	}

	const numAddTypes = new Set(['undefined', 'boolean', 'number']);
	const isNumAddOperands = (val) => numAddTypes.has(typeof val) || val === null;
	const bothTained = (sleft, sright) => isTainted(sleft) && isTainted(sright);

	const addTaintProp = function(left, right, result, op, pos)
	{
		const isWeirdType = (v) => !Utils.isNumber(v) && !Utils.isString(v);
		var aleft = actual(left);
		var aright = actual(right);
		var sleft = shadow(left);
		var sright = shadow(right);

		//log when type is weird
		if (isWeirdType(aleft) && config.logWhenWeirdAddOper)
			addLogRec(this, pos, "Left operand of + is type " + Utils.getTypeName(aleft));
		if (isWeirdType(aright) && config.logWhenWeirdAddOper)
			addLogRec(this, pos, "Right operand of + is type " + Utils.getTypeName(aright));
		if (bothTained(sleft, sright) && config.logWhenBothTaintArithOper)
		{
			addLogRec(this, pos, "Both operands of + are tainted");
		}

		if (isNumAddOperands(aleft) &&
			isNumAddOperands(aright))
		{//numeric add
			var taint_state = rule.arithmetic(
				sleft, sright, op, pos);
			return getTaintResult(result, taint_state);
		}
		else //if (typeof aleft === "string" &&
		//typeof aright === "string")
		{//string concatenation
			return stringConcatProp(left, right, result);
		}
	};

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
		var s = shadow(rawVal);
		var t = typeof val;
		var b = (t === 'string') && alwaysGiveNaNStr(val, s);
		return (t === 'object' && val !== null &&
			alwaysGiveNaNStr(String(val), getTaintArray(rawVal), rule)) ||
			t === 'undefined' || b || (t === 'number' && isNaN(val) && isUntainted(s));
	}
//string that will always produce NaN

	function binaryTaintProp(callback, log_callback, left, right, result, op, pos)
	{
		var aleft = actual(left);
		var aright = actual(right);
		var sleft = shadow(left);
		var sright = shadow(right);
		log_callback(this, aleft, aright, pos, op, sleft, sright);
		if (callback(left, right))
		{
			return result;
		}
		else
		{
			var taint_state = rule.arithmetic(
				rule.compressTaint(sleft),
				rule.compressTaint(sright),
				op, pos);
			return getTaintResult(result, taint_state);
		}
	}

	function unaryTaintProp(callback, log_callback, left, result, op, pos)
	{
		var aleft = actual(left);
		var sleft = shadow(left);
		log_callback(this, aleft, pos, op, sleft);
		if (callback(left))
		{
			return result;
		}
		else
		{
			var taint_state = rule.unaryArithmetic(
				rule.compressTaint(sleft),
				op, pos);
			return getTaintResult(result, taint_state);
		}
	}

	const numUnOperCallback = function (analysis, aleft, pos, op)
	{
		if (!Utils.isNumber(aleft) && config.logWhenWeirdArithOper)
			addLogRec(analysis, pos, "Operand of " + op + " is type " + Utils.getTypeName(aleft));
	};

	function unarithTaintProp(left, result, op, pos)
	{
		return unaryTaintProp.call(this,
			alwaysGiveNaN,
			numUnOperCallback,
			left, result, op, pos);
	}

	const numBinOperCallback = function (analysis, aleft, aright, pos, op)
	{
		if (!Utils.isNumber(aleft) && config.logWhenWeirdArithOper)
			addLogRec(analysis, pos, "Left operand of " + op + " is type " + Utils.getTypeName(aleft));
		if (!Utils.isNumber(aright) && config.logWhenWeirdArithOper)
			addLogRec(analysis, pos, "Right operand of " + op + " is type " + Utils.getTypeName(aleft));
	};

	function arithTaintProp(left, right, result, op, pos)
	{
		return binaryTaintProp.call(this, (left, right) =>
			alwaysGiveNaN(left) || alwaysGiveNaN(right),
			numBinOperCallback,
			left, right, result, op, pos);
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




	function shiftTaintProp(left, right, result, op, pos)
	{
		//if LHS is always NaN, result is always 0
		return binaryTaintProp.call(this, (left) => isZeroInOper(left),
			numBinOperCallback,
			left, right, result, op, pos);
	}

	const bitOpers = new Set(['|', '&', '^']);
	function cmpTaintProp(left, right, result, op, pos)
	{//todo, consider more cases to improve accuracy
		return binaryTaintProp.call(this, ()=>false,
			function(analysis, aleft, aright, pos, op, sleft, sright)
			{
				if (bitOpers.has(op) && config.logWhenBitOperTaint)
				{
					addLogRec(analysis, pos, "Tainted variable is used as operand of " + op);
				}
				if (bothTained(sleft, sright) && config.logWhenBothTaintCmpOper)
				{
					addLogRec(analysis, pos, "Both operands of "+op+" are tainted");
				}
			},
			left, right, result, op, pos);
	}


	function getPosition(iid)
	{
		return sandbox.iidToLocation(
			sandbox.getGlobalIID(iid));
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

		if (typeof aval == 'object' && aval === val)
		{
			outArrs.push(aval);
			var taints = {};
			for (var k in aval)
			{
				if (outArrs.indexOf(val[k]) === -1)
				{
					var stripped = stripTaintsH(val[k], outArrs);
					if (isTainted(stripped.taints))
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

	function isTaintedH(taint, outArr)
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
		else if (typeof taint === 'object')
		{
			outArr.push(taint);
			for (var k in taint)
			{
				if (outArr.indexOf(taint[k]) === -1)
				{
					if (isTaintedH(taint[k], outArr)) // !== rule.noTaint)
						return true;
				}
			}
			outArr.pop();
			return false;
		}
		else
		{
			return taint !== rule.noTaint && typeof taint != 'undefined';
		}
	}
	function isTainted(taint)
	{
		return isTaintedH(taint, []);
	}

	function getTaintResult(result, taint)
	{
		if (isUntainted(taint))
		{
			if (typeof taint == 'object' && !Array.isArray(taint))
				return new AnnotatedValue(result, {});
			else
				return result;
		}
		else
			return new AnnotatedValue(result, taint);
	}

	function mergeTaintsH(val, taints, outTaints)
	{
		outTaints.push(taints);
		for (var k in taints)
		{
			if (typeof taints[k] == 'object' && !Array.isArray(taints[k]))
			{//non-basic type taint
				if (outTaints.indexOf(taints[k]) === -1)
					val[k] = mergeTaintsH(val[k], taints[k], outTaints);
			}
			else if (isTainted(taints[k]))
			{
				val[k] = new AnnotatedValue(val[k], taints[k]);
			}
		}
		outTaints.pop();
		return val;
	}

	function mergeTaints(val, taints)
	{
		if (typeof taints == 'object' && !Array.isArray(taints))
		{
			return mergeTaintsH(val, taints, []);
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

	function andTaintProp(left, right, result, op, pos)
	{
		return binaryTaintProp.call(this, 
			(left, right) =>
				isZeroInOper(left) || isZeroInOper(right),
			function(){},
			left, right, result, op, pos);
	}
	this.binaryPre = function(iid, op, left, right)
	{
		return {op:op,left:left,right:right,skip:true}
	};
	this.binary = function(iid, op, left, right, result)
	{
		var pos = getPosition(iid);
		var ret;

		var aleft = actual(left);
		var aright = actual(right);
		switch (op)
		{
		case "+":
			result = aleft + aright;
			ret = {result: addTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "-":
			result = aleft - aright;
			ret = {result: arithTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "*":
			result = aleft * aright;
			ret = {result: arithTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "/":
			result = aleft / aright;
			ret = {result: arithTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "%":
			result = aleft % aright;
			ret = {result: arithTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "<<":
			result = aleft << aright;
			ret = {result: shiftTaintProp.call(this, left, right, result, op, pos)};
			break;
		case ">>":
			result = aleft >> aright;
			ret = {result: shiftTaintProp.call(this, left, right, result, op, pos)};
			break;
		case ">>>":
			result = aleft >>> aright;
			ret = {result: shiftTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "<":
			result = aleft < aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case ">":
			result = aleft > aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "<=":
			result = aleft <= aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case ">=":
			result = aleft >= aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "==":
			result = aleft == aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "!=":
			result = aleft != aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "===":
			result = aleft === aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "!==":
			result = aleft !== aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "&":
			result = aleft & aright;//todo: imprive accracy
			ret = {result: andTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "|":
			result = aleft | aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
			break;
		case "^":
			result = aleft ^ aright;
			ret = {result: cmpTaintProp.call(this, left, right, result, op, pos)};
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
	this.unaryPre = function (iid, op, left)
	{
		return {op:op, left:left, skip:true};
	};
	this.unary = function (iid, op, left, result)
	{
		var pos = getPosition(iid);
		var ret;
		var aleft = actual(left);
		switch (op)
		{
		case "+":
			result = +aleft;
			ret = {result:unarithTaintProp.call(this, left, result, op, pos)};
			break;
		case "-":
			result = -aleft;
			ret = {result:unarithTaintProp.call(this, left, result, op, pos)};
			break;
		case "~":
			result = ~aleft;
			ret = {result:unarithTaintProp.call(this, left, result, op, pos)};
			break;
		case "!":
			result = !aleft;
			ret = {result:unarithTaintProp.call(this, left, result, op, pos)};
			break;
		case "typeof":
			result = typeof aleft;
			ret = {result : result};
			break;
		case "void":
			result = void (aleft);
			ret = {result : result};
			break;
		default:
			throw new Error(op + " at " + iid + " not found");
			break;
		}
		return ret;
	};
	this.forinObject = function (iid, val)
	{
		return {result: actual(val)};
	};
	this.conditional = function (iid, result)
	{
		var aresult = actual(result);
		if (isTainted(shadow(result)) && config.logAtCond)
		{
			addLogRec(this, getPosition(iid), "Tainted variable " +
				JSON.stringify(aresult) + " being used in conditional");
		}
		return {result:aresult};
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
						Number(val.substr(11)), rule.taintSource(0))
				};
			}
			else if (val.substr(0, 14) === "ta1nt3d_string")
			{
				var ret = val.substr(14);
				var taint = Utils.fillArray(rule.taintSource(0), ret.length);
				return {result: new AnnotatedValue(ret, taint)};
			}
			else if (val === "ta1nt3d_bool")
			{
				return {result: new AnnotatedValue(true, rule.taintSource(0))};
			}
		}
		if (typeof val == 'object' && val !== null)
		{
			var strippedVal = stripTaints(val);
			return {result: getTaintResult(strippedVal.values, strippedVal.taints)}
		}
	};
	this.endExecution = function()
	{
		var res = "";
		for (var i = 0; i < this.results.length; i++)
		{
			res += JSON.stringify(this.results[i]);
			res += '\n';
		}
		Log.log(res);
	};
	this.invokeFunPre = function(iid, f, base, args, isConstructor, isMethod)
	{
		return {f:f, base:base, args:args, skip:true}
	};
	function callFunc(f, base, args, isConstructor)
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
			inst = new AnnotatedValue(new Temp, {});
			// Call the original Constructor with the temp
			// instance as its context (i.e. its 'this' value)
			var ret = constructor.apply(inst, args);
			// If an object has been returned then return it otherwise
			// return the original instance.
			// (consistent with behaviour of the new operator)
			return Object(ret) === ret ? ret : inst;
		}
		if (isConstructor)
		{
			return newInstance(f, args);
		}
		else
		{
			return f.apply(base, args);
		}
	}
	const actualArgs = (args) => Array.prototype.map.call(args, actual);
	const shadowArgs = (args) => Array.prototype.map.call(args, shadow);
	this.invokeFun = function(iid, f, base, args, result, isConstructor, isMethod)
	{
		var position = getPosition(iid);
		const charAtTaint = (ts, idx) =>
			strToTaintArr(taintArrToStr(ts).charAt(idx), ts);
		const callFun = sandbox.callFunExport;
		//todo: to remove, for test only
		if (f === 'assertTaint')
		{
			assertTaint(args[0], args[1], getPosition(iid));
			return {result : undefined};
		}
		else if (f === "assert")
		{
			myAssert(actual(args[0]), getPosition(iid));
			return {result : undefined};
		}
		else if (f === "debug")
		{
			Log.log("debug");
			return {result : undefined};
		}
		var af = actual(f);
		if (typeof af != 'function' && config.logWhenNonFuncBeingCalled)
		{
			addLogRec(this, position, "Type other than function being called");
		}
		if (af !== f)
		{
			if (config.logWhenTaintFuncBeingCalled)
			{
				addLogRec(this, position, "Tainted Function (shadow==" +
					JSON.stringify(shadow(f)) + ") being called");
			}
			f = af;
		}
		if (Utils.isNative(f))
		{
			var aargs = actualArgs(args), abase = actual(base);
			var sv, ret, taints, j;

			ret = sandbox.dtaBrowser.invokeFunSrc(f, abase, aargs);
			if (typeof ret != 'undefined')
			{
				return getTaintResult(ret.ret, ret.sv);
			}

			ret = sandbox.dtaBrowser.invokeFunSnk(f, abase, aargs,
				shadow(base), shadowArgs(args), isTainted);
			if (typeof ret != 'undefined')
			{
				addLogRec(this, position, ret.msg);
			}

			switch (f)
			{
			case Function.prototype.apply:
			{
				return this.invokeFun(iid, base, args[0], actual(args[1]),
					result, isConstructor, isMethod);
			}
			case String.prototype.substr:
			{//todo: what if index and size are tainted?
				//todo: maybe there is better way
				aargs = actualArgs(args);
				abase = actual(base);
				ret = callFun(f, abase, aargs, isConstructor, iid);
				const sliceTaint = (ts, idx, len) =>
					strToTaintArr(taintArrToStr(ts).
					substr(idx, len), ts);
				sv = sliceTaint(getTaintArray(base), aargs[0], aargs[1]);
			}
			break;
			case Number:
			{
				if (!alwaysGiveNaN(args[0], rule))
				{//todo: need change
					sv = rule.compressTaint(shadow(args[0]));
				}
				aargs = actualArgs(args);
				ret = callFun(f, base, aargs, isConstructor, iid);
			}
			break;
			case String.prototype.charAt:
			{
				aargs = actualArgs(args);
				abase = actual(base);
				ret = callFun(f, abase, aargs, isConstructor, iid);
				sv = charAtTaint(getTaintArray(base), aargs[0]);
				//todo: what if index is tainted
			}
			break;
			case String.prototype.charCodeAt:
			{
				aargs = actualArgs(args);
				abase = actual(base);
				ret = callFun(f, abase, aargs, isConstructor, iid);

				sv = rule.ordTaint(charAtTaint(getTaintArray(base), aargs[0]));
				//when taint array length == 0, sv == undefined, which gives no taint
				//todo: what if index is tainted
			}
			break;
			case String.fromCharCode:
			{
				if (!isZeroInOper(args[0]))
				{
					sv = rule.chrTaint(rule.compressTaint(
						shadow(args[0], rule.noTaint)));
				}
				aargs = actualArgs(args);
				ret = callFun(f, base, aargs, isConstructor, iid);
			}
			break;
			case String.prototype.concat:
			{
				aargs = actualArgs(args);
				abase = actual(base);
				ret = callFun(f, abase, aargs, isConstructor, iid);
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
				abase = actual(args[0]);
				ret = callFun(f, base, [abase], isConstructor, iid);
				sv = [];
				j = 0;
				for (let i = 0; i < taints.length; i++)
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
			case unescape:
			{
				const isHex = Utils.isHex;
				taints = getTaintArray(args[0]);
				abase = actual(args[0]);
				ret = callFun(f, base, [abase], isConstructor, iid);
				sv = [];
				for (let i = 0; i < abase.length;)
				{
					if (abase[i] === '%')
					{
						if (abase[i+1] === 'u' &&
							isHex(abase[i+2]) && isHex(abase[i+3]) &&
							isHex(abase[i+4]) && isHex(abase[i+5]))
						{
							const tmp = taints.slice(i, i+6);
							if (config.logWhenUnescapeDiffer &&
								!Utils.allSame(tmp))
							{
								addLogRec(this, position, "unescape element different");
							}
							sv.push(rule.unescapeTaint(tmp));
							i += 6;
						}
						else if (isHex(abase[i+1] && isHex(abase[i+2])))
						{
							const tmp = taints.slice(i, i+3);
							if (config.logWhenUnescapeDiffer &&
								!Utils.allSame(tmp))
							{
								addLogRec(this, position, "unescape element different");
							}
							sv.push(rule.unescapeTaint(tmp));
							i += 3;
						}
						else
						{
							sv.push(taints[i++]);
						}
					}
					else
					{
						sv.push(taints[i++]);
					}
				}
			}
			break;
			case Number.prototype.toString:
			{//base must be number, otherwise exception will be thrown
				abase = actual(base);
				if (!(abase instanceof Number) && typeof abase !== 'number')
					throw TypeError("Number.prototype.toString is not generic");
				aargs = actualArgs(args);

				rule.toStringTaint(base, shadow(base), (a) => callFun(f, a, aargs, isConstructor, iid));
			}
			break;
			case String.prototype.indexOf:
			{
				aargs = actualArgs(args);
				var baseTaintArr = getTaintArray(base);
				var argTaintArr = getTaintArray(args[0]);
				ret = callFun(f, actual(base), aargs, isConstructor, iid);
				var a1 = actual(args[1]);
				var startIdx = a1 < 0 || typeof a1 == 'undefined' ? 0 : a1;

				sv = rule.strIdxOfTaint(baseTaintArr, argTaintArr,
					startIdx, ret < 0 ? 0 :ret + argTaintArr.length);

			}
			break;
			case Array.prototype.push:
			{
				ret = callFun(f, base, args, isConstructor, iid);
			}
			break;
			default:
			{
				if (config.logForUnprocNativeFunc)
				{
					addLogRec(this, position, "Unhandled native function " + f.name);
				}
				aargs = actualArgs(args);
				abase = actual(base);
				ret = callFun(f, abase, aargs, isConstructor, iid);
			}
			break;
			}
			//convert arguments to actual value

			//todo: process other type of native function
			return {result:getTaintResult(ret, sv)};
		}
		else
		{
			return {result:callFunc(f, base, args, isConstructor, iid)};
		}
	};
	this.getFieldPre = function(iid, base, offset)
	{
		return {base:base, offset:offset, skip:true};
	};
	this.getField = function (iid, base, offset)
	{
		var pos = getPosition(iid);
		var abase = actual(base);
		var aoff = actual(offset);
		var soff = shadow(offset);
		var sbase = shadow(base);
		var ret;

		if (isTainted(soff) && config.logWhenTaintedOffset)
		{
			addLogRec(this, pos, "Tainted offset");
		}

		ret = sandbox.dtaBrowser.getField(abase, aoff, config);
		if (typeof ret != 'undefined')
		{
			return {result:getTaintResult(ret.ret, ret.sv)};
		}
		else
		{
			var sv, f;
			if (typeof abase == "string"
				&& Number.isInteger(aoff)
				&& aoff < sbase.length)
			{//is accessing string character
				f = rule.getStringCharTaint;
			}
			else if (typeof abase == 'object')
			{//array & object
				f = rule.getFieldTaint;
			}
			else
			{
				return {result: abase[aoff]};
			}
			sv = sbase[aoff];
			ret = abase[aoff];
			sv = f(sv, soff);
			ret = getTaintResult(ret, sv);
		}
		this.read(iid, String(aoff), ret);
		return {result:ret};
	};
	this.putFieldPre = function (iid, base, offset, val)
	{
		return {base:base, offset:offset, val:val, skip:true};
	};
	this.putField = function (iid, base, offset, val)
	{
		const abase = actual(base);
		const sbase = shadow(base);
		const aoff = actual(offset);
		const aval = actual(val), sval = shadow(val);

		if (isTainted(sval))
		{
			const ret = sandbox.dtaBrowser.putField(
				abase, aoff, aval, sval, config);
			if (typeof ret !== 'undefined')
			{
				addLogRec(this, getPosition(iid), ret.msg);
			}
			else
			{
				this.write(iid, String(aoff), val);
			}
		}


		abase[aoff] = aval;//todo, when offset tainted?
		sbase[aoff] = sval;

		return {result:val};
	};
	this._with = function (iid, val)
	{
		var aval = actual(val); // get `val` field
		var sval = shadow(val); // get `shadow` field
		var ret = {};
		for (var k in aval)
		{
			/*
			traverse all fields,
			create correct AnnotatedValue object with corresponding shadow value,
			assign it to the corresponding field of the newly created object,
			*/
			ret[k] = getTaintResult(aval[k], sval[k]);
			//getTaintResult is a wrapper for creation of AnnotatedValue,
			//and will create AnnotatedValue object only if shadow value is tainted,
			//which is just an optimization
		}
		return {result:ret};
		//return that newly created object
	};
	function rwRec(analysis, iid, name, val, rw)
	{
		const pos = getPosition(iid);
		if (val instanceof AnnotatedValue || isTainted(shadow(val)))
		{
			const typeOf = typeof actual(val);
			analysis.results.push(
				{
					type: rw, typeOf: typeOf,
					file: pos.fname, pos: pos.pos,
					name: name
				});
		}
	}
	this.read = function (iid, name, val)
	{
		rwRec(this, iid, name, val, 'read');
	};
	this.write = function (iid, name, val)
	{
		rwRec(this, iid, name, val, 'write');
	};
}
const taintUnit = sandbox.dtaTaintLogic;
sandbox.analysis = new TaintAnalysis(taintUnit, config);
})(J$);