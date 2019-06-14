# Testing

To have proper software engineering design, I have written test cases to ensure the analysis is running correctly. However, the approach to test is somewhat different from normal program. Since the `JsTainter` heavily relies on `Jalangi2` framework, it's quite hard to simply import the taint analysis unit and perform unit testing only on that unit. The reason is that `Jalangi2` has done many things for `JsTainter`, and `JsTainter` does not work without this framework.

Therefore, instead, I have formulated a way to perform testing. Since we can instrument the JavaScript program that the analysis is running on, we can instrument on function call to perform our assertion.

## Checking Taint State

```javascript
var a; //something whose taint state is to be examined
const assertTaint = "assertTaint";
assertTaint(a, true);
```

The codes above will simply throw an exception in normal execution. However, if it is instrumented by our analysis program, we can examine the value of `function` parameter in the function call instrumentation callback. This value should be a `function` type variable in normal case, but if it is a `string` type variable and has value `"assertTaint"`, then we know we are going to perform assertion against the taint state of given variable, instead of executing the function call that will throw the error.

In `assertTaint` function, the main goal is to check if `shadow(val)` (actual shadow value) is same as `taint` (expected shadow value). If they are not exactly same, assertion will fail. Variable `position` is the position of instruction that will be printed if assertion fails, which makes debug more convenient.

```javascript
function myAssert(b, position)
{
	if (b !== true)
	{
		Log.log("Assertion failure at" + JSON.stringify(position));
		assert(false);
	}
}
function assertTaint(val, taint, position)
{
	taint = actual(taint);
	// taint might be wrapped by AnnotatedValue, just in case
	const s = shadow(val);
	myAssert(typeof s === typeof taint, position);
	// type must be identical
	if (Array.isArray(s))
	{// if shadow value is array, all elements must be same
		myAssert(s.length === taint.length, position);
		for (var i = 0; i < s.length; i++)
		{
			myAssert(s[i] === taint[i], position);
		}
	}
	else
	{// for any other cases such as basic-type case, shadow must be equal
		myAssert(s === taint, position);
	}
}

//in the instrumentation callback handler of function call
if (f === 'assertTaint')
{
	assertTaint(args[0], args[1], getPosition(iid));
}
```

Note that these 2 pieces of codes above are in different files. The first code piece is in the JavaScript file that is going to be analyzed (e.i. `test.js`); while the second code piece is in the file that performs the dynamic taint analysis (e.i. `DynTaintAnalysis.js`) . Therefore, even if we have same `assertTaint` name as identifier in both files, there will not be any conflict.

## Checking Real Value

Using the similar technique, real value of variable can also be checked. `"assert"` can be used to examine the correctness of real value of variable, and it is handled in the same way as `"assertTaint"`. 

```javascript
else if (f === "assert")
{
	myAssert(actual(args[0]), getPosition(iid));
	return {result : undefined};
}
```

The usage of `assert` is a little bit different from `assertTaint`. Because real value can be directly access by program that is being analyzed, comparison can be done in the JavaScript program. For example,

```javascript
const assert = "assert";
assert(a == 1);
```

## Evaluation on Basic Test Cases

### Implementation

To test the correctness of `JsTainter`, I have written many test cases in directory `tests/`. This will be tested by a simple Python script.

```python
from os import system,walk
from re import search
cmd = "node jalangi2/src/js/commands/jalangi.js --inlineIID --inlineSource --analysis jalangi2/src/js/sample_analyses/ChainedAnalyses.js --analysis Utils.js --analysis Log.js --analysis TaintLogic.js --analysis NullBrowser.js --analysis DefaultConfig.js --analysis DynTaintAnalysis.js tests/%s"

i = 0
for root,subdirs,files in walk("./tests/"):
	i += 1
assert i == 1

for f in files:
	ret = search("^test[a-zA-Z0-9]+\\.js$", f)
	if ret: # iterate file with format testxxx.js
		print "Testing file: " + f
		ret = system(cmd % f) # execute analysis
		if ret != 0:
			print "Error in file %s" % f
			exit(-1)
```

The reason why regular expression is used to filter file name is that Jalangi2 will generate some temporary files in that directory when analysis is performed, such as `testxxx_jalangi_.js` and `testxxx_jalangi_.json`, and only files with correct file name format should be analyzed and tested.

### Tests

There are many test cases, and I will discuss them one by one.

`testarith.js` is used to test the taint propagation of arithmetic operation, especially when one of the operand is tainted string. For example, `(taintedStr + '123' + taintedStr) * 7` should be tainted because the result of this operation can be affected by `taintedStr` if it is a numeric string; while `(taintedStr + '0x' + taintedStr) * 7` should not be tainted because it always gives `NaN` no matter how `taintedStr` changes.

`testarithAdd.js` is used to test correctness of taint propagation of `add` operation.

`testbitoper.js` and `testshift.js` are used to test correctness of taint propagation of bit-wise operation, cases that operands are types other than number are also considered here.

`testcharAt.js`, `testindexOf.js` and `testsubstr.js` are used to test correctness of taint propagation of function `String.prototype.charAt`, `String.prototype.indexOf` and `String.prototype.substr` respectively, cases that arguments are types other than number are also considered here.

`testconstructor.js` is used to test taint propagation in JavaScript class. For example, when argument passed to constructor is tainted and is used to initialize the member fields, the fields should also be tainted. Also, `with` statement is also tested here.

`testeval.js` is used to test `eval` statement. In other word, taint propagation must also works well even if the statement that causes the taint propagation is executed using `eval`.

`testException.js` is used to test the case that when a tainted variable is thrown, the `catch` statement that receive the variable being thrown must also get the tainted value. //todo drawback

`testfield.js` is used to test correctness of taint propagation of putting field and getting field.

`testforinObject.js` is used to test correctness of `for in object` loop, which are properly handled by `analysis.forinObject` instrumentation callback function.

`testfunc.js` is used to test non-constructor function call, including anonymous function. //todo drawback

`testNumber.js` is used to test `Number` function. For example, when tainted string is casted to number by `Number` function, the return value should be tainted if it is controllable by the tainted argument.

`testConcat.js` is used to test string concatenation by operator `+`.

# Evaluation on Website



1. eval on self written web site
2. eval on web CTF challenge?
3. eval on real world website
4. eval on usability, e.g. environment congifuation
5. drawback: anti-instrumentation
6.   

