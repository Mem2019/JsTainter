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

//const lambda = (a,b) => a+b;

//todo: instrumentCode and instrumentCodePre
//function antiInstrumentation(){var a = 3;}
//assert(String(antiInstrumentation) === "function antiInstrumentation(){var a = 3;}");

taintedStr = "ta1nt3d_stringAAAA";
s = "BBBB" + taintedStr;
assertTaint(s.indexOf('B'), false);
assertTaint(s.indexOf('AB'), false);
assertTaint(s.indexOf('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'), false);
assertTaint(s.indexOf('A'), true);
assertTaint(s.indexOf('BA'), true);