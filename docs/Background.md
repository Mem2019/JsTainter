# Dynamic Analysis

To perform dynamic taint analysis, we must be able to track and analyze every possible JavaScript operation, otherwise it is possible to miss some critical operations and produce false positive or false negative results. It is also required to pass information between operations, otherwise taint flow cannot be traced at all. When I was preparing the project, I found several possible ways that dynamic analysis can be performed.

## Debug Protocol

The debug protocol is designed for remote debugger: for example, JavaScript IDE uses debug protocol to interact with JavaScript codes being executed in browser, and IDE can use debug protocol to step in, step out and continue until hitting breakpoint. We can also use this debug protocol to trace the program being analyzed and perform dynamic taint analysis. However, there are several problems.

**Firstly**, the on-line resource of debug protocol development is rare. The only resource seems to be the official document, which is a API documentation instead of a step-by-step tutorial, thus a bit hard to understand.

**Secondly**, I am not sure if debug protocol supports tracing every operation. For example, in step-in command in IDE, a statement `a = b * c + d` will be jumped over directly rather than be separated as multiplication and addition, but this is what we need for accurate dynamic taint analysis. Thus if debug protocol does not support such operation and I have spent too much time on it, it will be wasteful.

Therefore, using debug protocol is too risky and not appropriate for my project.

## Modifying JavaScript Engine for Analysis

Since JavaScript is always executed by JavaScript engine, we can modify the code of JavaScript engine for dynamic analysis. However, here are several problems.

**Firstly**, if analysis is performed in this way, user must use modified version of browser, which is too heavy compared to a  proxy or browser extension. In addition, the product will heavily bond to specific browser, so there would be no portability at all.

**Secondly**, such implementation is hard. I need to understand JavaScript engine in advance before modifying its code, which might take long. Also, JavaScript is not only executed by interpreter, but it will also be compiled just-in-time when a section of codes is executed very frequently. This could make things very complicated since I would also need to modify the JIT compiler so that I can still analyze codes even if they are compiled in JIT.

Therefore, the cumbersomeness and difficulty of this approach suggests this is not a good way.

## Instrumentation

Instrumentation is a common way to perform dynamic analysis. It modifies codes to be analyzed and insert the codes to perform analysis. For example, [Intel Pin Tool](https://software.intel.com/en-us/articles/pin-a-dynamic-binary-instrumentation-tool) is a dynamic code instrumentation tool for binary program. [AFL Fuzzer](http://lcamtuf.coredump.cx/afl/) also applies instrumentation technique to generate high code coverage for binary program. Although instrumentation for binary program is common, counterpart resources in field of JavaScript analysis are quite rare. Here are possible ways that JavaScript program can be instrumented.

### Byte Code Level Instrumentation

JavaScript byte code is a intermediate representation of JavaScript, and it varies among different browser engine. Since byte code is more like assembly than a high level language, the instrumentation in this level is a bit similar to binary instrumentation that I have discussed above. 

However, unlike binary instrumentation, in which there are many resources on-line, JavaScript byte code instrumentation has rarely been investigated before. Also such low-level instrumentation is too dependent on specific browser: for example, the instrumentation on V8 byte code, the JavaScript engine used by Chrome, cannot work at SpiderMonkey,  the JavaScript engine used by FireFox. Therefore, this might not be a good approach. 

### Source Code Level Instrumentation

Source code instrumentation is to instrument through modifying JavaScript file, usually by proxy. Fortunately, there is one framework that provides such functionality, Jalangi2, which is a big advantage. Also, this does not depend on particular JavaScript engine in specific browser, so it is more portable. Therefore, this becomes my final choice of dynamic analysis, and I will explain this in detail in next section.

# Jalangi2

## Overview

[`Jalangi2`](https://github.com/Samsung/jalangi2) is a dynamic analysis framework for JavaScript that supports dynamic analysis based on instrumentation. This framework can modify the source code of the program being analyzed and provide interface that enables developer to instrument callback function before and after each JavaScript operation. For example, before and after any JavaScript binary operators (e.g. `+`), user of Jalangi2 can instrument his own functions to inspect and modify the behavior of such operation. Since this framework has already implemented language-level preprocessing such parsing and instrumentation, developer who uses this framework does not have to worry about it. Instead, according to its [tutorial](https://manu.sridharan.net/files/JalangiTutorial.pdf), it is very easy to use this framework. Here is an example that instrument on the `binary` operator in JavaScript.

```javascript
//Analysis.js
(function (sandbox)
{
function Analysis(rule)
{
	this.binaryPre = function (...) {...}
	this.binary = function (...) {...}
}
sandbox.analysis = new Analysis();
})(J$);
```

By setting these fields to the function we want, when binary operator such as `+` is executed, our functions `binaryPre` and `binary` will also be executed. The relative argument such as operands will be passed as argument, and we can also use return value of these functions to modify the dynamic behavior of the binary operator such as changing the result. 

### Instrumentation

As I just suggested, Jalangi2 works by source code level instrumentation. The input JavaScript source will be converted to instrumented JavaScript, which will then be run by the JavaScript interpreter. Since the instrumented JavaScript will call the callback functions that we have defined (e.g. `binaryPre` shown above), analysis can be performed by every possible JavaScript operation.

In Jalangi2, every operation will be wrapped by a member function of `J$`, and this class can be regarded as the *main class* of Jalangi2. For example, binary operation would be wrapped by `J$.B`, in which our instrumentation callback function is called and actual binary operation are performed. These functions not only wrap the operation but also are placed before or after some JavaScript statement. For example, `J$.Se` is placed before JavaScript file, and `J$.Fe` is placed before function body. In these functions our corresponding callbacks will also be called, if any. 

Here is an example that demonstrate behavior of instrumentation.

```javascript
//before instrumentation
function add(a, b)
{
	return a+b;
}

//after instrumentation
function add(a, b) {
	jalangiLabel0:
		while (true) {
			try {
				J$.Fe(113, arguments.callee, this, arguments); // J$.Fe for function entry
				arguments = J$.N(121, 121, arguments, 4);
				a = J$.N(129, 129, a, 4);
				b = J$.N(137, 137, b, 4);
				return J$.X1(105, J$.Rt(97, J$.B(10, '+', J$.R(81, 'a', a, 0), J$.R(89, 'b', b, 0), 0))); // J$.B for binary operator
			} catch (J$e) {
				J$.Ex(921, J$e);
			} finally {
				if (J$.Fr(929))
					continue jalangiLabel0;
				else
					return J$.Ra();
			}
		}
}
```

### J$

As I suggested above, this is the main class of Jalangi2. Just as the example above shown, the `analysis` property need to be assigned by us to instrument callback functions. In addition, this class could be shared when files are chained together using `ChainedAnalyses.js` provided by Jalangi2, and this feature can be used to export class. For example, I have implemented a `Utils` class that contains some utility functions. Since this is implemented in a separate file, we cannot use this class directly in another file. However, by using `J$`, we can easily export this class, as illustrated below.

```javascript
//Utils.js
(function (sandbox)
{
	Utils.prototype.func2 = function() {...};
	Utils.prototype.func1 = function() {...};
	//define func1 and func2
	sandbox.myUtils = new Utils(); //store instance into `myUtils` field of J$
})(J$);
//Analysis.js
(function (sandbox)
{
	const utils = sandbox.myUtils; // fetch `myUntils` field from J$
	function Analysis()
	{
		// ...
		utils.func1(...); // use func1 somewhere
		utils.func2(...); // use func2 somewhere
		// ...
	}
	sandbox.analysis = new Analysis();
})(J$);
```

### Run

Here is the bash command that run the analysis. `ChainedAnalyses.js` is critical since it is the script that chains everything together.

```bash
node jalangi2/src/js/commands/jalangi.js --inlineIID --inlineSource --analysis jalangi2/src/js/sample_analyses/ChainedAnalyses.js --analysis Utils.js --analysis Analysis.js file_to_be_analyzed.js
```

### Operations

Here is the full list of the JavaScript operations that can be instrumented, which already cover all possible JavaScript program behaviors.

//todo, add pic and ref

## [Shadow Value](https://mem2019.github.io/jekyll/update/2019/04/26/Jalangi2-Shadow-Value.html)

`Shadow Value` is a concept formulated in [Jalangi paper](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.455.9073&rep=rep1&type=pdf). The key point is that there could be another shadow value associated with a variable. In the paper, `AnnotatedValue` class is used to denote the variable that has any shadow value along with it. The `value` field of this class is the original value of this variable, while `shadow` field is the shadow value associated with this variable. For example, if an integer variable `1337` has shadow value `true`, the variable will be an `AnnotatedValue` object with field `value` being `1337` and field `shadow` being `true`, denoted as `AnnotatedValue(1337, true)` (I will use this notation in the following report). This shadow value concept is important because `JsTainter` will use shadow value to record the taint state about a variable, which is necessary in dynamic taint analysis.

However, I found that mechanism of shadow value of `Jalangi2`, works differently from the one mentioned in this [paper](https://people.eecs.berkeley.edu/~ksen/papers/jalangi.pdf). The reason might be that the version is different: the paper covers `Jalangi1` while I am using `Jalangi2`. Of course, `JsTainter` can use `Jalangi1` instead of `Jalangi2`, but `Jalangi1` has not been maintained for many years, so using `Jalangi1` may exist more risk of encountering bugs in the framework.

In the paper (`Jalangi1`), it is suggested to use a `AnnotatedValue` to replace some variables, just as I discussed above, and as long as the variable is used for some operation, `actual(value)` is used to convert it to actual value for operation. For example, `actual(AnnotatedValue(1337, true)) === 1337`.  Then when our analysis callback function `analysis.binary` is called, `value` is passed as the arguments instead of `actual(value)`. The logic is shown as below, according to the pseudo-codes in the paper.

```javascript
//definition of AnnotatedValue
function AnnotatedValue(val, shadow)
{
	this.val = val;
	this.shadow = shadow;
}
function actual(val)
{
	return val instanceof AnnotatedValue ? val.val : val;
}
//when executing instrumented code of binary operator
var result = actual(left) op actual(right) //call `actual` before used as operands 
if (analysis && analysis.binary)//original `left` and `right` are passed
    analysis.binary(op, left, right, result)
```

However, in Jalangi2, things works differently: here is the pseudo-code representing the source code logic of `Jalangi2` when binary operator is handled.

```javascript

function B(iid, op, left, right, flags) {
	var result, aret, skip = false;

	if (sandbox.analysis && sandbox.analysis.binaryPre) {
		aret = sandbox.analysis.binaryPre(iid, op, left, right);
		if (aret) {
			op,left,right,skip = aret.op,aret.left,aret.right,aret.skip;
		}//a `binaryPre` is added
	}
	if (!skip) {
		result = left op right;
	}//no `actual()` being applied before using as operands

	if (sandbox.analysis && sandbox.analysis.binary) {
        /*
        `left` and `right` being passed to our `analysis.binary` handler
        are same as ones used as operands,
        which is different from the approach mentioned in paper
        */
		aret = sandbox.analysis.binary(iid, op, left, right, result);
		if (aret) {
			result = aret.result;
		}
	}
	return (lastComputedValue = result);
}
```

Therefore, it seems that `AnnotatedValue` class is not supported in `Jalangi2`, but instead, shadow value is associated with a object reference. `SMemory` is a mechanism that support shadow value feature in `Jalangi2`. However, the drawback of this approach is that we cannot have a shadow value associated with primitive value, including `string`. Therefore, since the approach of `Jalangi1` mentioned in the paper is better for me to use, I will define `AnotatedValue` by myself, and then define `analysis.binaryPre` to let `skip === true`, and perform calculation inside `analysis.binary` instead. In addition, I will do this for all operations, not only binary operator.

Here is the pseudo-codes that describe what I am thinking about.

```javascript
this.binaryPre = function(iid, op, left, right)
{
	return {op:op,left:left,right:right,skip:true}//skip
}
this.binary = function(iid, op, left, right, result)
{
	var result;
	var aleft = actual(left);
	var aright = actual(right);

	result = left op right;
	//use left and right to perform analysis

	return {result : result} 
}
```

In this way we can use the shadow value in the same way as `Jalangi1`. 

## Location

Jalangi2 has provided an `iid` argument for each instrumentation callback function, which is the `Static Unique Instruction Identifier` that is used to specify the specific instruction that is being analyzed currently. It can also be used to specify the position of the instruction: `J$.iidToLocation(J$.getGlobalIID(iid))` is the code that can be used to get the position of current instruction being analyzed in the original codes, where `J$` is the global variable used by `Jalangi2` mentioned above.

The returned position is a string, with format `([absolute path of js file]:[starting line number]:[starting column number]:[end line number]:[end column number])` in `node.js`. For example, if there is an assignment `a = b + c` at line 17, and at the callback instrumentation function of writing the value into `a` (e.i. `write`), the position being obtained will be `/path/to/file.js:17:1:17:2`, while `1` and `2` stand for `a` starts at column 1 and ends at column 2. We can use such position string to identify the position of a particular instruction in original codes.

However, when instrumentation is run in browser, position with different format appears, after reading the source codes of Jalangi2, I found this piece of code that generates the position string in `iidToLocation.js`.

```javascript
arr = ret[iid];
if (arr) {
	if (sandbox.Results) {
		return "<a href=\"javascript:iidToDisplayCodeLocation('"+gid+ \
			"');\">(" + fname + ":" + arr[0] + ":" + arr[1] + \
			":" + arr[2] + ":" + arr[3] + ")</a>";
	} else {
		return "(" + fname + ":" + \
			arr[0] + ":" + arr[1] + ":" + \
			arr[2] + ":" + arr[3] + ")";
	}
} else {
	return "(" + fname + ":iid" + iid + ")";
}
```

Therefore, as shown above, there are 3 kinds of position string format: the first one gives `gid`, file name and information about line and column; the second one does not gives `gid` but still gives file name and information about line and column, which is the format that I appears in `node.js` illustrated above; and the third one only gives file name and `iid`, because `arr` that should contains information about line and column now is `undefined`. During my project I have not encountered the third case, so I think that one is a bit unrelated to the project. As for the other 2 cases, although what Jalangi2 chooses to provide is a string, what I need is actually these variables used to generate this string. Thus, instead of obtaining such string and parse it back by my myself, I would choose to modify the code of Jalangi2 to make `iidToLocation` return a JSON instead of a string. Here is the modified version of code.

```javascript
arr = ret[iid];
if (arr) {
	if (sandbox.Results) {
		return {gid:gid, fname:fname, pos:arr};
	} else {
		return {fname:fname, pos:arr};
	}
} else {
	return {fname: fname, iid:iid};
}
```

The information being returned is exactly same, except now the form is in JSON instead of a string.

## Bug

Even if Jalangi2 is an great framework, some bugs still exist since it has not been maintained for 3 years. There is one bug that is triggered very frequently, so I have fixed this bug by modifying some codes in Jalangi2.

### Constant Declaration

**Cause**

In JavaScript, developer can declare a constant that cannot be modified once being assigned by `const a = something`. However, we cannot access the variable before this statement.

```javascript
alert(a); 
//cause ReferenceError instead of returning `undefined`
const a = 1 + f(a); // this also causes ReferenceError 
```

In the code, variable `a` are used before declaration and assignment, which causes `ReferenceError`. This JavaScript feature leads to a bug in Jalangi2, which is caused by improper instrumentation. The bug is triggered when any constant declaration is instrumented by Jalangi2, for example `const x = "1"`. When this declaration is instrumented, following instrumented JavaScript will be generated.

```javascript
J$.N(41, 'x', x, 0); // x is used before statement `const x`
const x = J$.X1(25, J$.W(17, 'x', J$.T(9, "1", 21, false), x, 3)); // x is also used here
```

As I mentioned in last section, `J$` is the main class of Jalangi2, and its member functions are called. However, the problem is that variable `x` is used before it is actually declared, which causes `ReferenceError` when the instrumented version is run. 

By the way, declaration like `var a = a` (where `a` has not been declared before) will not cause this problem and `a` will equal to `undefined` after this statement, and this is the reason why `var` declaration does not trigger this error.

**Fix**

My approach to fix this error is very simple. The reason why instrumented version of JavaScript file access the variable before declaration is that original value of the variable need to be passed as argument, as the documentation of Jalangi2 suggests. However, this functionality is not actually very useful, at least not useful for my project. Therefore, if we can prevent such early access of variable (e.g. change that argument to something else), the `ReferenceError` can be prevented. To be specific, we need to change `x` passed as argument to both `J$.N` and `J$.W`.

In Jalangi2, file `src/js/instrument/esnstrument.js` implements JavaScript source code instrumentation, and we need to find the piece of codes that generates the corresponding instrumented JavaScript, and modify the arguments that cause error. The idea is that when the corresponding instrumented code in string form is generated, method name `".N"` and `".W"` must be referenced, so I decided search such string in that file, and these 2 lines are interesting and possibly relate to instrumented code generation.

```javascript
var logInitFunName = JALANGI_VAR + ".N";
var logWriteFunName = JALANGI_VAR + ".W";
```

We may need to debug the Jalangi2 to make things more clear, so I have used a shortest code that generate the `ReferenceError`, namely `const x = "1"`, to be instrumented. By setting the breakpoint, we can easily find that `JALANGI_VAR` equals to `"J$"`. Then after looking for the cross reference, these variables are used in this way, which is very likely to be instrumented code generation. There are several pieces of codes like this, but they are essentially same, so I will only show and explain one of them here.

```javascript
logInitFunName + "(" + RP + "1, " + RP + "2, " + RP + "3, " + ... 
```

However, if I set a breakpoint here, I found that value of `RP` equals to `"J$_"`, so the result of string concatenation is something like `"J$.N(J$_1, J$_2, J$_3, 0)"` which is not same as result instrumented code. However, this result will be passed to function `replaceInStatement`, which I think is the function that replaces the `J$_X` by the real argument. However, this is not important, the arguments can already be modified now although a bit hack: `J$_3` corresponds to the third argument `x` that causes `ReferenceError`, so we modify it to something else such as `J$_2`, so the third argument will become `'x'` now. The same thing applies for all other references of `logInitFunName` and `logWriteFunName`. This is the instrumented codes after modifying Jalangi2 code, in which all `x`s are replaced by `'x'`.

```javascript
J$.N(41, 'x', 'x', 0);
const x = J$.X1(25, J$.W(17, 'x', J$.T(9, "1", 21, false), 'x', 3));
```
