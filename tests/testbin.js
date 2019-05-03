var a = "ta1nt3d_int";
var b = a + 2;
var d = 10 + a;
var c = b + a;
//process.stdout.write(c.toString())
var s = ''+c;
s = s.substr(0, 3);
var sb = "BBBB";
s += sb;
s = s.substr(2, 2);

var bool = "ta1nt3d_bool";
s = ''+bool + s;
s = s.substr(1, s.length);

var arr = [undefined,,bool, a, [3, bool,, c, undefined], undefined];
arr[1] = arr;
arr[4][2] = arr;
arr[4][2] = arr;
arr[4][5] = arr[4];
//circular structure
s = ''+arr;
s = s.substr(0, s.length);

//process.stdout.write(s)