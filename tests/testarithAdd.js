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
//test arithmetic add
a = taintedInt + 0;
assertTaint(a, true);
var b = a + 0;
assertTaint(b, true);
a = 123;
assertTaint(a, false);
b += a;
assertTaint(b, true);
a = 1 + 2 + 3;
assertTaint(a, false);