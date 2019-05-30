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

//test eval
taintedInt = "ta1nt3d_int0";
a = undefined;
eval("a = taintedInt + 0");
assert(a === 0);
assertTaint(a, true);