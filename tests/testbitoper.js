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

//test &
assertTaint(taintedStr & NaN, false);
assertTaint(taintedStr & null, false);
assertTaint(taintedStr & "asd", false);
assertTaint(taintedStr & undefined, false);
assertTaint(taintedStr & (taintedStr+'0x'+taintedStr), false);
assertTaint(taintedStr & 0, false);
assertTaint(taintedInt & NaN, false);
assertTaint(taintedInt & null, false);
assertTaint(taintedInt & "asd", false);
assertTaint(taintedInt & undefined, false);
assertTaint(taintedInt & (taintedInt+'0x'+taintedInt), false);
assertTaint(taintedInt & 0, false);

//test |
assertTaint(taintedStr | NaN, true);
assertTaint(taintedStr | null, true);
assertTaint(taintedStr | "asd", true);
assertTaint(taintedStr | undefined, true);
assertTaint(taintedStr | (taintedStr+'0x'+taintedStr), true);
assertTaint(taintedStr | 0, true);
assertTaint(taintedInt | NaN, true);
assertTaint(taintedInt | null, true);
assertTaint(taintedInt | "asd", true);
assertTaint(taintedInt | undefined, true);
assertTaint(taintedInt | (taintedInt+'0x'+taintedInt), true);
assertTaint(taintedInt | 0, true);


//test |
assertTaint(taintedStr ^ NaN, true);
assertTaint(taintedStr ^ null, true);
assertTaint(taintedStr ^ "asd", true);
assertTaint(taintedStr ^ undefined, true);
assertTaint(taintedStr ^ (taintedStr+'0x'+taintedStr), true);
assertTaint(taintedStr ^ 0, true);
assertTaint(taintedInt ^ NaN, true);
assertTaint(taintedInt ^ null, true);
assertTaint(taintedInt ^ "asd", true);
assertTaint(taintedInt ^ undefined, true);
assertTaint(taintedInt ^ (taintedInt+'0x'+taintedInt), true);
assertTaint(taintedInt ^ 0, true);