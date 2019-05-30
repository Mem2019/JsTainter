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


//test get&put field
obj = {};
assertTaint(obj["something"], false);
obj.a = "ta1nt3d_int0";
obj["b"] = "ta1nt3d_stringAAAA";
obj["1"] = "ta1nt3d_int1";
obj["0"] = 2019;
obj[obj] = obj;
assert(obj[{}] === obj);
assert(obj["a"] === 0);
assertTaint(obj["a"], true);
assert(obj[[[1]]] === 1);
assertTaint(obj[[[1]]], true);
assert(obj[[obj[1]]] === 1);
assertTaint(obj[obj[[1]]], true);
assert(obj[[obj['a']]] === 2019);
assertTaint(obj[obj[['a']]], false);