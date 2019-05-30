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

taintedInt = "ta1nt3d_int31337";
taintedStr = "ta1nt3d_stringAAAA";


//test string concat
taintedStr += "no";
assertTaint(taintedStr, [true, true, true, true, false, false]);
taintedStr = taintedStr.substr(0, 3);
assertTaint(taintedStr, [true, true, true]);
a = taintedStr + 123;
assertTaint(a, [true, true, true, false, false, false]);
var suba = a.substr(2, 2);
assertTaint(suba, [true, false]);
suba = a.substr(2, 31337);
assertTaint(suba, [true, false, false, false]);
