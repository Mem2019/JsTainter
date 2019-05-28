function isNative(func)
{
	var toString = Function.prototype.toString;
	var expr = /function [a-zA-Z_][a-zA-Z0-9_]*\(\)[ \t\n]*\{[ \t\n]*\[native code\][ \t\n]*\}/;
	var res = (toString.call(func)).match(expr);
	return (res !== null && res[0] === toString.call(func))
}
const isNumber = (n) => n instanceof Number || typeof n == 'number';
const isString = (s) => s instanceof String || typeof s == 'string';

function fillArray(value, len)
{
	if (len <= 0 || typeof len != 'number') return [];
	var a = [value];
	while (a.length * 2 <= len) a = a.concat(a);
	if (a.length < len) a = a.concat(a.slice(0, len - a.length));
	return a;
}//https://stackoverflow.com/questions/12503146/create-an-array-with-same-element-repeated-multiple-times

function getTypeName(v)
{
	if (v === null)
		return "null";
	if (typeof v == 'undefined')
		return "undefined";
	return v.constructor.name;
}

function Utils(){}
Utils.prototype.isNative = isNative;
Utils.prototype.fillArray = fillArray;
Utils.prototype.isNumber = isNumber;
Utils.prototype.isString = isString;
Utils.prototype.getTypeName = getTypeName;
Utils.prototype.assert = require('assert');//todo: node.js

//todo: ----------nodejs
module.exports = {
	Utils : Utils
};
//----------nodejs