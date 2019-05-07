const assertTaint = "assertTaint";
var taintedInt = "ta1nt3d_int31337";
var taintedStr = "ta1nt3d_stringAAAA";
//test arithmetic add
var a = taintedInt + 0;
assertTaint(a, true);
var b = a + 0;
assertTaint(b, true);
a = 123;
assertTaint(a, false);
b += a;
assertTaint(b, true);
a = 1 + 2 + 3;
assertTaint(a, false);

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

//test shift <<
assertTaint(taintedStr << NaN, true);
assertTaint(taintedStr << null, true);
assertTaint(taintedStr << "asd", true);
assertTaint(taintedStr << undefined, true);
assertTaint(taintedStr << (taintedStr+'0x'+taintedStr), true);
assertTaint(NaN << taintedStr, false);
assertTaint(null << taintedStr, false);
assertTaint("asd" << taintedStr, false);
assertTaint(undefined << taintedStr, false);
assertTaint((taintedStr+'0x'+taintedStr) << taintedStr, false);
assertTaint(0 << taintedStr, false);
assertTaint(taintedInt << NaN, true);
assertTaint(taintedInt << null, true);
assertTaint(taintedInt << "asd", true);
assertTaint(taintedInt << undefined, true);
assertTaint(taintedInt << (taintedInt+'0x'+taintedInt), true);
assertTaint(NaN << taintedInt, false);
assertTaint(null << taintedInt, false);
assertTaint("asd" << taintedInt, false);
assertTaint(undefined << taintedInt, false);
assertTaint((taintedInt+'0x'+taintedInt) << taintedInt, false);
assertTaint(0 << taintedInt, false);

//test shift >>
assertTaint(taintedStr >> NaN, true);
assertTaint(taintedStr >> null, true);
assertTaint(taintedStr >> "asd", true);
assertTaint(taintedStr >> undefined, true);
assertTaint(taintedStr >> (taintedStr+'0x'+taintedStr), true);
assertTaint(NaN >> taintedStr, false);
assertTaint(null >> taintedStr, false);
assertTaint("asd" >> taintedStr, false);
assertTaint(undefined >> taintedStr, false);
assertTaint((taintedStr+'0x'+taintedStr) >> taintedStr, false);
assertTaint(0 >> taintedStr, false);
assertTaint(taintedInt >> NaN, true);
assertTaint(taintedInt >> null, true);
assertTaint(taintedInt >> "asd", true);
assertTaint(taintedInt >> undefined, true);
assertTaint(taintedInt >> (taintedInt+'0x'+taintedInt), true);
assertTaint(NaN >> taintedInt, false);
assertTaint(null >> taintedInt, false);
assertTaint("asd" >> taintedInt, false);
assertTaint(undefined >> taintedInt, false);
assertTaint((taintedInt+'0x'+taintedInt) >> taintedInt, false);
assertTaint(0 >> taintedInt, false);

//test shift >>>
assertTaint(taintedStr >>> NaN, true);
assertTaint(taintedStr >>> null, true);
assertTaint(taintedStr >>> "asd", true);
assertTaint(taintedStr >>> undefined, true);
assertTaint(taintedStr >>> (taintedStr+'0x'+taintedStr), true);
assertTaint(NaN >>> taintedStr, false);
assertTaint(null >>> taintedStr, false);
assertTaint("asd" >>> taintedStr, false);
assertTaint(undefined >>> taintedStr, false);
assertTaint((taintedStr+'0x'+taintedStr) >>> taintedStr, false);
assertTaint(0 >>> taintedStr, false);
assertTaint(taintedInt >>> NaN, true);
assertTaint(taintedInt >>> null, true);
assertTaint(taintedInt >>> "asd", true);
assertTaint(taintedInt >>> undefined, true);
assertTaint(taintedInt >>> (taintedInt+'0x'+taintedInt), true);
assertTaint(NaN >>> taintedInt, false);
assertTaint(null >>> taintedInt, false);
assertTaint("asd" >>> taintedInt, false);
assertTaint(undefined >>> taintedInt, false);
assertTaint((taintedInt+'0x'+taintedInt) >>> taintedInt, false);
assertTaint(0 >>> taintedInt, false);

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

assertTaint(Number(taintedStr), true);
assertTaint(Number(taintedStr + '123' + taintedStr), true);
assertTaint(Number(taintedStr + '0x' + taintedStr), false);
assertTaint(Number(taintedStr + 'e' + taintedStr), true);

assertTaint(taintedInt - [], true);
assertTaint(taintedInt - ({}), false);
assertTaint(taintedInt - ({a : 1}), false);
assertTaint(taintedInt - [1], true);
assertTaint(taintedInt - [1,2], false);

//test Number
assertTaint(taintedInt - new Number(0), true);
assertTaint(taintedStr - new Number(0), true);

//test substr
var taintedBool = "ta1nt3d_bool";
var taintedIdx = "ta1nt3d_int2";
taintedStr = taintedBool + "BBBB";
assertTaint(taintedStr, [true,true,true,true,false,false,false,false]);
a = taintedStr.substr(taintedIdx, taintedIdx + 1);
assertTaint(a, [true, true, false]);
var o = {a:1};
/*
todo:
decide if bit-wise taint, or number-wise
boolean taint, or enum taint
taint analysis for all other operations
result of taint propagation, json format, frequecy?
tainted integer inside array or object, or even string

bit-wise: algorithm intensive

taint analysis rule:
represent taint for each stirng as an array of bools
represent taint for each number as a bool
string + number?
string + bool?
string - string? == NaN taint? number how to taint?

object/array shadow value structure?

Taint Structure:
1. number/string easy
2. array/map: key will not be tainted,
	although might cause false negative,
	only value will be tainted,
	and array/object as a whole will not be tainted

*/