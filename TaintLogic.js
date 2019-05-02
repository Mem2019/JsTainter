//todo: --------------nodejs
const Utils = new (require("./Utils").Utils)();
//----------nodejs

function TaintUnit() {}
TaintUnit.prototype.noTaint = false;
TaintUnit.prototype.fullTaint = true;
TaintUnit.prototype.arithmetic = function(left, right)
{
	return left || right;
};
TaintUnit.prototype.toStringTaint = (a,t)=>Utils.fillArray(t, (''+a).length);

//todo, make it an array of boolean

//todo: ------------nodejs
module.exports = {
	TaintUnit : TaintUnit
};
//----------nodejs