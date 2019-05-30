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

assertTaint(Number(taintedStr), true);
assertTaint(Number(taintedStr + '123' + taintedStr), true);
assertTaint(Number(taintedStr + '0x' + taintedStr), false);
assertTaint(Number(taintedStr + 'e' + taintedStr), true);
//test Number
assertTaint(taintedInt - new Number(0), true);
assertTaint(taintedStr - new Number(0), true);
