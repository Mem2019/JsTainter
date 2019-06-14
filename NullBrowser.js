(function (sandbox) {
	function Browser(){}
	Browser.prototype.getField = function () {};
	Browser.prototype.putField = function () {};
	Browser.prototype.invokeFunSrc = function () {};
	Browser.prototype.invokeFunSnk = function () {};
	sandbox.dtaBrowser = new Browser();
})(J$);