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


//test charAt and charCodeAt
s = "ta1nt3d_stringAA" + "BB";
assert(s === "AABB");
assertTaint(s.charAt(1), [true]);
assertTaint(s.charAt(2), [false]);
assertTaint(s.charAt(4), []);
assertTaint(s.charAt(0x10000000), []);
assertTaint(s.charAt(-1), []);
assertTaint(s.charAt("asd"), [true]);
assertTaint(s.charAt(NaN), [true]);
assertTaint(s.charAt(null), [true]);
assertTaint(s.charCodeAt(1), true);
assertTaint(s.charCodeAt(2), false);
assertTaint(s.charCodeAt(4), false);
assertTaint(s.charCodeAt(0x10000000), false);
assertTaint(s.charCodeAt(-1), false);
assertTaint(s.charCodeAt("asd"), true);
assertTaint(s.charCodeAt(NaN), true);
assertTaint(s.charCodeAt(null), true);

