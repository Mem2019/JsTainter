function TaintUnit()
{

}
TaintUnit.prototype.noTaint = false;
TaintUnit.prototype.fullTaint = true;
TaintUnit.prototype.arithmetic = function(left, right)
{
	return left || right;
};
//todo, make it an array of boolean

module.exports = {
	TaintUnit : TaintUnit
};