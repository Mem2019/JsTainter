var assertTaint = "assertTaint";
var assert = "assert";
var obj = {}
var a = "ta1nt3d_intNaN";
var b = "ta1nt3d_stringNaN";

obj.a = a;
obj.b = b;
var i = 0;
for (var k in obj)
{
	if (i == 0)
	{
		assertTaint(obj[k], true);
	}
	else if (i == 1)
	{
		assertTaint(obj[k], [true, true, true]);
	}
	++i;
}
assert(i == 2);