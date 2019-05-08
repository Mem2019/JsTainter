function Utils(){}
Utils.prototype.isNative = isNative;
Utils.prototype.fillArray = fillArray;
Utils.prototype.assert = require('assert');//todo: node.js

function isNative(func)
{
	var toString = Function.prototype.toString;
	var expr = /function [a-zA-Z_][a-zA-Z0-9_]*\(\)[ \t\n]*\{[ \t\n]*\[native code\][ \t\n]*\}/;
	var res = (toString.call(func)).match(expr);
	return (res !== null && res[0] === toString.call(func))
}

function fillArray(value, len)
{
	if (len <= 0 || typeof len != 'number') return [];
	var a = [value];
	while (a.length * 2 <= len) a = a.concat(a);
	if (a.length < len) a = a.concat(a.slice(0, len - a.length));
	return a;
}//https://stackoverflow.com/questions/12503146/create-an-array-with-same-element-repeated-multiple-times

//todo: ----------nodejs
module.exports = {
	Utils : Utils
};
//----------nodejs