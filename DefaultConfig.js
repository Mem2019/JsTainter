(function (sandbox)
{
	function DefaultConfig()
	{
		this.ifTaintNaN = true;
		this.ifTaintResWhenKeyTaint = false;
		this.ifTaintElemWhenKeyTaint = false;
		this.logWhenWeirdAddOper = true;
		this.logWhenWeirdArithOper = true;
		this.logWhenBothTaintCmpOper = true;
		this.logWhenBitOperTaint = true;
		this.logWhenTaintedOffset = true;
		this.logWhenNonFuncBeingCalled = true;
		this.logWhenTaintFuncBeingCalled = true;
		this.logAtCond = true;
		this.taintPathName = false;
		this.ifTaintUndefined = true;
		this.logForUnprocNativeFunc = true;
		this.logWhenUnescapeDiffer = true;
	}
	sandbox.dtaConfig = new DefaultConfig();
})(J$);