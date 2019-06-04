(function (sandbox) {
function Browser(){}
Browser.prototype.getField = function (base, offset)
{
	if (base === window.location)
	{
		switch (offset)
		{
		case "hash":
		case "search":
			return sandbox.dtaUtils.fillArray(
					sandbox.dtaTaintLogic.prototype.fullTaint,
					base[offset].length);
		//todo: case "href":
		}
	}
};
sandbox.dtaBrowser = new Browser();
})(J$);