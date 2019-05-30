var assertTaint = "assertTaint";
var assert = "assert";
var debug = "debug";
var taintedInt;
var taintedStr;
var taintedBool;
var taintedIdx;
var taintedArr;
var s,a;
var obj;


//test substr
taintedBool = "ta1nt3d_bool";
taintedIdx = taintedInt = "ta1nt3d_int2";
taintedStr = taintedBool + "BBBB";
assert(taintedStr === "trueBBBB");
assertTaint(taintedStr, [true,true,true,true,false,false,false,false]);
a = taintedStr.substr(taintedIdx, taintedIdx + 1);
assert(a === "ueB");
assertTaint(a, [true, true, false]);
taintedArr = [a, taintedInt, [a]];
taintedArr[3]=taintedArr;
s = String.prototype.substr.apply(taintedArr, [0]);
assertTaint(s, [true, true, false, false, true, false, true, true, false, false]);
assert(s === "ueB,2,ueB,");
assertTaint("123" + taintedArr,
	[false, false, false, true, true, false, false, true, false, true, true, false, false]);
assert("123" + taintedArr === "123ueB,2,ueB,");
assertTaint(s.substr(-4, 3), [true,true,false]);
assertTaint(s.substr(-4, NaN), []);
assertTaint(String.prototype.substr.apply(taintedArr, [-4, 3]), [true,true,false]);
assertTaint(String.prototype.substr.apply(taintedArr, [-4, NaN]), []);
var taintedObj = {a:taintedInt, b:taintedArr, c:taintedBool};
taintedObj["obj"] = taintedObj;
assertTaint(String.prototype.substr.apply(taintedObj, [0]),
	[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]);
//"[object Object]"
assertTaint(String.prototype.substr.apply(global, [0]),
	[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]);
//"[object global]"
