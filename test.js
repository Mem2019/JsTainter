var a = "ta1nt3d_int";
var b = a + 2;
var d = 10 + a;
var c = b + a;
//process.stdout.write(c.toString())
var s = "ta1nt3d_string";
s = s.substr(0, 3);
var sb = "BBBB";
s += sb;
s = s.substr(2, 2);

//var o = {a:1};
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