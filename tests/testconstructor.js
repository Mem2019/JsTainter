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


//test constructor
function Test(p)
{
	this.test1 = p + 3;
	this.test2 = p - 3;
}
obj = new Test("ta1nt3d_intNaN");
assertTaint(obj.test1, true);
assert(isNaN(obj.test1));
with (obj)
{
	assertTaint(test2, true);
	assert(isNaN(test2));
}
assert(obj instanceof Test);

