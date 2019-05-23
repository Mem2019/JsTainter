const assertTaint = "assertTaint";
// const assert = "assert";
// const debug = "debug";
// var taintedInt;
// var taintedStr;
// var taintedBool;
// var taintedIdx;
// var taintedArr;
// var s,a;
// var obj;
//
// //const lambda = (a,b) => a+b;
//
// //todo: instrumentCode and instrumentCodePre
// //function antiInstrumentation(){var a = 3;}
// //assert(String(antiInstrumentation) === "function antiInstrumentation(){var a = 3;}");
//
// //test constructor
// function Test(p)
// {
// 	this.test1 = p + 3;
// 	this.test2 = p - 3;
// }
// obj = new Test("ta1nt3d_intNaN");
// assertTaint(obj.test1, true);
// assert(isNaN(obj.test1));
// with (obj)
// {
// 	assertTaint(test2, true);
// 	assert(isNaN(test2));
// }
// assert(obj instanceof Test);
//
//
// //test eval
// taintedInt = "ta1nt3d_int0";
// a = undefined;
// eval("a = taintedInt + 0");
// assert(a === 0);
// assertTaint(a, true);
//
// //test function
// function add(a, b)
// {
// 	return a+b;
// }
//
// const add2 = function (a,b) {return a+b};
// taintedInt = "ta1nt3d_int0";
// a = add(taintedInt, 0);
// assertTaint(a, true);
// assert(a === 0);
// a = add2(a, 0);
// assertTaint(a, true);
// assert(a === 0);
//
//
//
//
// //test get&put field
// obj = {};
// assertTaint(obj["something"], false);
// obj.a = "ta1nt3d_int0";
// obj["b"] = "ta1nt3d_stringAAAA";
// obj["1"] = "ta1nt3d_int1";
// obj["0"] = 2019;
// obj[obj] = obj;
// assert(obj[{}] === obj);
// assert(obj["a"] === 0);
// assertTaint(obj["a"], true);
// assert(obj[[[1]]] === 1);
// assertTaint(obj[[[1]]], true);
// assert(obj[[obj[1]]] === 1);
// assertTaint(obj[obj[[1]]], true);
// assert(obj[[obj['a']]] === 2019);
// assertTaint(obj[obj[['a']]], false);
//
// //test String.prototype.concat
// taintedStr = "ta1nt3d_stringAAA";
// taintedInt = "ta1nt3d_int0";
// a = taintedInt + 3;
// taintedArr = [taintedStr, a, undefined,[a]];
//
// taintedArr[2] = taintedArr;
// debug();
// s = taintedStr.concat("BB", taintedInt, a, taintedArr);
// debug();
// assert(s === "AAABB03AAA,3,,3");
// assertTaint(s, [true, true, true, false, false, true, true, true, true, true,
// 				false, true, false, false, true]);
//
// //test charAt and charCodeAt
// s = "ta1nt3d_stringAA" + "BB";
// assert(s === "AABB");
// assertTaint(s.charAt(1), [true]);
// assertTaint(s.charAt(2), [false]);
// assertTaint(s.charAt(4), []);
// assertTaint(s.charAt(0x10000000), []);
// assertTaint(s.charAt(-1), []);
// assertTaint(s.charAt("asd"), [true]);
// assertTaint(s.charAt(NaN), [true]);
// assertTaint(s.charAt(null), [true]);
// assertTaint(s.charCodeAt(1), true);
// assertTaint(s.charCodeAt(2), false);
// assertTaint(s.charCodeAt(4), false);
// assertTaint(s.charCodeAt(0x10000000), false);
// assertTaint(s.charCodeAt(-1), false);
// assertTaint(s.charCodeAt("asd"), true);
// assertTaint(s.charCodeAt(NaN), true);
// assertTaint(s.charCodeAt(null), true);
//
//
//
// //test substr
// taintedBool = "ta1nt3d_bool";
// taintedIdx = taintedInt = "ta1nt3d_int2";
// taintedStr = taintedBool + "BBBB";
// assert(taintedStr === "trueBBBB");
// assertTaint(taintedStr, [true,true,true,true,false,false,false,false]);
// a = taintedStr.substr(taintedIdx, taintedIdx + 1);
// assert(a === "ueB");
// assertTaint(a, [true, true, false]);
// taintedArr = [a, taintedInt, [a]];
// taintedArr[3]=taintedArr;
// s = String.prototype.substr.apply(taintedArr, [0]);
// assertTaint(s, [true, true, false, false, true, false, true, true, false, false]);
// assert(s === "ueB,2,ueB,");
// assertTaint("123" + taintedArr,
// 	[false, false, false, true, true, false, false, true, false, true, true, false, false]);
// assert("123" + taintedArr === "123ueB,2,ueB,");
// assertTaint(s.substr(-4, 3), [true,true,false]);
// assertTaint(s.substr(-4, NaN), []);
// assertTaint(String.prototype.substr.apply(taintedArr, [-4, 3]), [true,true,false]);
// assertTaint(String.prototype.substr.apply(taintedArr, [-4, NaN]), []);
// var taintedObj = {a:taintedInt, b:taintedArr, c:taintedBool};
// taintedObj["obj"] = taintedObj;
// assertTaint(String.prototype.substr.apply(taintedObj, [0]),
// 	[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]);
// //"[object Object]"
// assertTaint(String.prototype.substr.apply(global, [0]),
// 	[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]);
// //"[object global]"
//
// taintedInt = "ta1nt3d_int31337";
// taintedStr = "ta1nt3d_stringAAAA";
// //test arithmetic add
// a = taintedInt + 0;
// assertTaint(a, true);
// var b = a + 0;
// assertTaint(b, true);
// a = 123;
// assertTaint(a, false);
// b += a;
// assertTaint(b, true);
// a = 1 + 2 + 3;
// assertTaint(a, false);
//
// //test string concat
// taintedStr += "no";
// assertTaint(taintedStr, [true, true, true, true, false, false]);
// taintedStr = taintedStr.substr(0, 3);
// assertTaint(taintedStr, [true, true, true]);
// a = taintedStr + 123;
// assertTaint(a, [true, true, true, false, false, false]);
// var suba = a.substr(2, 2);
// assertTaint(suba, [true, false]);
// suba = a.substr(2, 31337);
// assertTaint(suba, [true, false, false, false]);
//
// //test arithmetic operation -
// taintedStr = "ta1nt3d_string31337";
// assertTaint(taintedStr - 7, true);
// assertTaint(("0x" + taintedStr) - 7, true);
// assertTaint(("0." + taintedStr) - 7, true);
// assertTaint(("0x." + taintedStr) - 7, false);
// assertTaint((taintedStr) - 7, true);
// assertTaint((taintedStr + '123' + taintedStr) - 7, true);
// assertTaint((taintedStr + '0x' + taintedStr) - 7, false);
// assertTaint((taintedStr + 'e' + taintedStr) - 7, true);
//
// // *
// assertTaint(taintedStr * 7, true);
// assertTaint(("0x" + taintedStr) * 7, true);
// assertTaint(("0." + taintedStr) * 7, true);
// assertTaint(("0x." + taintedStr) * 7, false);
// assertTaint((taintedStr) * 7, true);
// assertTaint((taintedStr + '123' + taintedStr) * 7, true);
// assertTaint((taintedStr + '0x' + taintedStr) * 7, false);
// assertTaint((taintedStr + 'e' + taintedStr) * 7, true);
//
// // /
// assertTaint(taintedStr / 7, true);
// assertTaint(("0x" + taintedStr) / 7, true);
// assertTaint(("0." + taintedStr) / 7, true);
// assertTaint(("0x." + taintedStr) / 7, false);
// assertTaint((taintedStr) / 7, true);
// assertTaint((taintedStr + '123' + taintedStr) / 7, true);
// assertTaint((taintedStr + '0x' + taintedStr) / 7, false);
// assertTaint((taintedStr + 'e' + taintedStr) / 7, true);
//
// // %
// assertTaint(taintedStr % 7, true);
// assertTaint(("0x" + taintedStr) % 7, true);
// assertTaint(("0." + taintedStr) % 7, true);
// assertTaint(("0x." + taintedStr) % 7, false);
// assertTaint((taintedStr) % 7, true);
// assertTaint((taintedStr + '123' + taintedStr) % 7, true);
// assertTaint((taintedStr + '0x' + taintedStr) % 7, false);
// assertTaint((taintedStr + 'e' + taintedStr) % 7, true);
//
// //test shift <<
// //(a,b) => a && b;
// //assertTaint([taintedInt] << [taintedInt], true);
// assertTaint(taintedStr << NaN, true);
// assertTaint(taintedStr << null, true);
// assertTaint(taintedStr << "asd", true);
// assertTaint(taintedStr << undefined, true);
// assertTaint(taintedStr << (taintedStr+'0x'+taintedStr), true);
// assertTaint(NaN << taintedStr, false);
// assertTaint(null << taintedStr, false);
// assertTaint("asd" << taintedStr, false);
// assertTaint(undefined << taintedStr, false);
// assertTaint((taintedStr+'0x'+taintedStr) << taintedStr, false);
// assertTaint(0 << taintedStr, false);
// assertTaint(taintedInt << NaN, true);
// assertTaint(taintedInt << null, true);
// assertTaint(taintedInt << "asd", true);
// assertTaint(taintedInt << undefined, true);
// assertTaint(taintedInt << (taintedInt+'0x'+taintedInt), true);
// assertTaint(NaN << taintedInt, false);
// assertTaint(null << taintedInt, false);
// assertTaint("asd" << taintedInt, false);
// assertTaint(undefined << taintedInt, false);
// assertTaint((taintedInt+'0x'+taintedInt) << taintedInt, false);
// assertTaint(0 << taintedInt, false);
//
// //test shift >>
// assertTaint(taintedStr >> NaN, true);
// assertTaint(taintedStr >> null, true);
// assertTaint(taintedStr >> "asd", true);
// assertTaint(taintedStr >> undefined, true);
// assertTaint(taintedStr >> (taintedStr+'0x'+taintedStr), true);
// assertTaint(NaN >> taintedStr, false);
// assertTaint(null >> taintedStr, false);
// assertTaint("asd" >> taintedStr, false);
// assertTaint(undefined >> taintedStr, false);
// assertTaint((taintedStr+'0x'+taintedStr) >> taintedStr, false);
// assertTaint(0 >> taintedStr, false);
// assertTaint(taintedInt >> NaN, true);
// assertTaint(taintedInt >> null, true);
// assertTaint(taintedInt >> "asd", true);
// assertTaint(taintedInt >> undefined, true);
// assertTaint(taintedInt >> (taintedInt+'0x'+taintedInt), true);
// assertTaint(NaN >> taintedInt, false);
// assertTaint(null >> taintedInt, false);
// assertTaint("asd" >> taintedInt, false);
// assertTaint(undefined >> taintedInt, false);
// assertTaint((taintedInt+'0x'+taintedInt) >> taintedInt, false);
// assertTaint(0 >> taintedInt, false);
//
// //test shift >>>
// assertTaint(taintedStr >>> NaN, true);
// assertTaint(taintedStr >>> null, true);
// assertTaint(taintedStr >>> "asd", true);
// assertTaint(taintedStr >>> undefined, true);
// assertTaint(taintedStr >>> (taintedStr+'0x'+taintedStr), true);
// assertTaint(NaN >>> taintedStr, false);
// assertTaint(null >>> taintedStr, false);
// assertTaint("asd" >>> taintedStr, false);
// assertTaint(undefined >>> taintedStr, false);
// assertTaint((taintedStr+'0x'+taintedStr) >>> taintedStr, false);
// assertTaint(0 >>> taintedStr, false);
// assertTaint(taintedInt >>> NaN, true);
// assertTaint(taintedInt >>> null, true);
// assertTaint(taintedInt >>> "asd", true);
// assertTaint(taintedInt >>> undefined, true);
// assertTaint(taintedInt >>> (taintedInt+'0x'+taintedInt), true);
// assertTaint(NaN >>> taintedInt, false);
// assertTaint(null >>> taintedInt, false);
// assertTaint("asd" >>> taintedInt, false);
// assertTaint(undefined >>> taintedInt, false);
// assertTaint((taintedInt+'0x'+taintedInt) >>> taintedInt, false);
// assertTaint(0 >>> taintedInt, false);
//
// //test &
// assertTaint(taintedStr & NaN, false);
// assertTaint(taintedStr & null, false);
// assertTaint(taintedStr & "asd", false);
// assertTaint(taintedStr & undefined, false);
// assertTaint(taintedStr & (taintedStr+'0x'+taintedStr), false);
// assertTaint(taintedStr & 0, false);
// assertTaint(taintedInt & NaN, false);
// assertTaint(taintedInt & null, false);
// assertTaint(taintedInt & "asd", false);
// assertTaint(taintedInt & undefined, false);
// assertTaint(taintedInt & (taintedInt+'0x'+taintedInt), false);
// assertTaint(taintedInt & 0, false);
//
// //test |
// assertTaint(taintedStr | NaN, true);
// assertTaint(taintedStr | null, true);
// assertTaint(taintedStr | "asd", true);
// assertTaint(taintedStr | undefined, true);
// assertTaint(taintedStr | (taintedStr+'0x'+taintedStr), true);
// assertTaint(taintedStr | 0, true);
// assertTaint(taintedInt | NaN, true);
// assertTaint(taintedInt | null, true);
// assertTaint(taintedInt | "asd", true);
// assertTaint(taintedInt | undefined, true);
// assertTaint(taintedInt | (taintedInt+'0x'+taintedInt), true);
// assertTaint(taintedInt | 0, true);
//
//
// //test |
// assertTaint(taintedStr ^ NaN, true);
// assertTaint(taintedStr ^ null, true);
// assertTaint(taintedStr ^ "asd", true);
// assertTaint(taintedStr ^ undefined, true);
// assertTaint(taintedStr ^ (taintedStr+'0x'+taintedStr), true);
// assertTaint(taintedStr ^ 0, true);
// assertTaint(taintedInt ^ NaN, true);
// assertTaint(taintedInt ^ null, true);
// assertTaint(taintedInt ^ "asd", true);
// assertTaint(taintedInt ^ undefined, true);
// assertTaint(taintedInt ^ (taintedInt+'0x'+taintedInt), true);
// assertTaint(taintedInt ^ 0, true);
//
// assertTaint(Number(taintedStr), true);
// assertTaint(Number(taintedStr + '123' + taintedStr), true);
// assertTaint(Number(taintedStr + '0x' + taintedStr), false);
// assertTaint(Number(taintedStr + 'e' + taintedStr), true);
//
// assertTaint(taintedInt - [], true);
// assertTaint(taintedInt - ({}), false);
// assertTaint(taintedInt - ({a : 1}), false);
// assertTaint(taintedInt - [1], true);
// assertTaint(taintedInt - [1,2], false);
//
// //test Number
// assertTaint(taintedInt - new Number(0), true);
// assertTaint(taintedStr - new Number(0), true);
//
//
//
// /*
// todo:
// decide if bit-wise taint, or number-wise
// boolean taint, or enum taint
// taint analysis for all other operations
// result of taint propagation, json format, frequecy?
// tainted integer inside array or object, or even string
//
// bit-wise: algorithm intensive
//
// taint analysis rule:
// represent taint for each stirng as an array of bools
// represent taint for each number as a bool
// string + number?
// string + bool?
// string - string? == NaN taint? number how to taint?
//
// object/array shadow value structure?
//
// Taint Structure:
// 1. number/string easy
// 2. array/map: key will not be tainted,
// 	although might cause false negative,
// 	only value will be tainted,
// 	and array/object as a whole will not be tainted
//
// */