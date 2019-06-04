var tainted_str = "ta1nt3d_stringAAAA";

try
{
	throw tainted_str;
}
catch (e)
{
	"assertTaint"(e, [true,true,true,true]);
}