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

taintedStr = "ta1nt3d_string31337";
taintedInt = "ta1nt3d_int31337";

assertTaint(taintedInt - [], true);
assertTaint(taintedInt - ({}), false);
assertTaint(taintedInt - ({a : 1}), false);
assertTaint(taintedInt - [1], true);
assertTaint(taintedInt - [1,2], false);