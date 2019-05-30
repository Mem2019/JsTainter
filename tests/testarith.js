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


//test arithmetic operation -
taintedStr = "ta1nt3d_string31337";
assertTaint(taintedStr - 7, true);
assertTaint(("0x" + taintedStr) - 7, true);
assertTaint(("0." + taintedStr) - 7, true);
assertTaint(("0x." + taintedStr) - 7, false);
assertTaint((taintedStr) - 7, true);
assertTaint((taintedStr + '123' + taintedStr) - 7, true);
assertTaint((taintedStr + '0x' + taintedStr) - 7, false);
assertTaint((taintedStr + 'e' + taintedStr) - 7, true);

// *
assertTaint(taintedStr * 7, true);
assertTaint(("0x" + taintedStr) * 7, true);
assertTaint(("0." + taintedStr) * 7, true);
assertTaint(("0x." + taintedStr) * 7, false);
assertTaint((taintedStr) * 7, true);
assertTaint((taintedStr + '123' + taintedStr) * 7, true);
assertTaint((taintedStr + '0x' + taintedStr) * 7, false);
assertTaint((taintedStr + 'e' + taintedStr) * 7, true);

// /
assertTaint(taintedStr / 7, true);
assertTaint(("0x" + taintedStr) / 7, true);
assertTaint(("0." + taintedStr) / 7, true);
assertTaint(("0x." + taintedStr) / 7, false);
assertTaint((taintedStr) / 7, true);
assertTaint((taintedStr + '123' + taintedStr) / 7, true);
assertTaint((taintedStr + '0x' + taintedStr) / 7, false);
assertTaint((taintedStr + 'e' + taintedStr) / 7, true);

// %
assertTaint(taintedStr % 7, true);
assertTaint(("0x" + taintedStr) % 7, true);
assertTaint(("0." + taintedStr) % 7, true);
assertTaint(("0x." + taintedStr) % 7, false);
assertTaint((taintedStr) % 7, true);
assertTaint((taintedStr + '123' + taintedStr) % 7, true);
assertTaint((taintedStr + '0x' + taintedStr) % 7, false);
assertTaint((taintedStr + 'e' + taintedStr) % 7, true);
