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


//test String.prototype.concat
taintedStr = "ta1nt3d_stringAAA";
taintedInt = "ta1nt3d_int0";
a = taintedInt + 3;
taintedArr = [taintedStr, a, undefined,[a]];

taintedArr[2] = taintedArr;
debug();
s = taintedStr.concat("BB", taintedInt, a, taintedArr);
debug();
assert(s === "AAABB03AAA,3,,3");
assertTaint(s, [true, true, true, false, false, true, true, true, true, true,
				false, true, false, false, true]);