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

//test function
function add(a, b)
{
	return a+b;
}

var add2 = function (a,b) {return a+b};
taintedInt = "ta1nt3d_int0";
a = add(taintedInt, 0);
assertTaint(a, true);
assert(a === 0);
a = add2(a, 0);
assertTaint(a, true);
assert(a === 0);
a = (function (a, b)
{
	return (function (a, b) {return add2(a, b)})(a,b);
})(0, taintedInt);
assertTaint(a, true);
assert(a === 0);