---
layout: post
title:  "Reflection about JavaScript Taint Analysis"
date:   2019-04-29 01:01:05 +0000
categories: jekyll update
---

# Overview

Unlike binary program, whose behavior is simple and easy to analysis, JavaScript is highly dynamic and very complex, thus hard to analysis. I will cover possible implementations of data structure of shadow value along with JavaScript variable, and their pros and cons. Also, here is some of my reflection about the cases that we need to consider when implementing dynamic taint analysis for JavaScript, possible ways to deal with them, and the drawbacks of these approaches.

# Jalangi2

## Overview

[`Jalangi2`](https://github.com/Samsung/jalangi2) is a dynamic analysis framework for JavaScript that supports instrumentation analysis. This framework can modify the source code of the program being analyzed and instrument code before and after each JavaScript operation. For example, before and after any JavaScript binary operators (e.g. `+`), we can instrument our own functions to inspect and modify the behavior of such operation. Since this framework has already implemented language-level preprocessing such parsing and instrumentation, developer who uses this framework does not have to worry about it. Instead, according to its [tutorial](https://manu.sridharan.net/files/JalangiTutorial.pdf), it is very easy to use this framework. Here is an example that instrument on the `binary` operator in JavaScript.

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

By setting these fields to the function we want, when binary operator such as `+` is executed, our functions will also be executed. The relative argument such as operands will be passed as argument, and we can also use return value of these functions to modify the behavior of the binary operator such as changing the result. 

Then run `Jalangi2` framework using `nodejs`, passing `Analysis.js` and JavaScript program to be analyzed as argument to run the analysis. 

Here is the full list of the JavaScript operations that can be instrumented, which already cover all possible JavaScript program behaviors.

//todo, add pic and ref

## [Shadow Value](https://mem2019.github.io/jekyll/update/2019/04/26/Jalangi2-Shadow-Value.html)

`Shadow Value` is a concept formulated in [Jalangi paper](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.455.9073&rep=rep1&type=pdf). The key point is that there could be another shadow value associated with a variable. In the paper, `AnnotatedValue` class is used to denote the variable that has any shadow value along with it. The `value` field of this class is the original value of this variable, while `shadow` field is the shadow value associated with this variable. For example, if an integer variable `1337` has shadow value `true`, the variable will be an `AnnotatedValue` object with field `value` being `1337` and field `shadow` being `true`, denoted as `AnnotatedValue(1337, true)` (I will use this notation in the following report). This shadow value concept is important because `JsTainter` will use shadow value to record the taint state information about a variable, which is necessary in dynamic taint analysis.

However, I found that mechanism of shadow value of `Jalangi2`, works differently from the one mentioned in this [paper](https://people.eecs.berkeley.edu/~ksen/papers/jalangi.pdf). The reason might be that the version is different: the paper covers `Jalangi1` while I am using `Jalangi2`. Of course, `JsTainter` can use `Jalangi1` instead of `Jalangi2`, but `Jalangi1` has not been maintained for many years, so using `Jalangi1` may have more risk of encountering bugs in the framework.

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

Therefore, it seems that `AnnotatedValue` class is not supported in `Jalangi2`, but instead, shadow value is associated with a object reference. `SMemory` is a mechanism that support shadow value feature in `Jalangi2`. However, the drawback of this approach is that we cannot have a shadow value assoicated with primitive value, including `string`. Therefore, since the approach of `Jalangi1` mentioned in the paper is better for me to use, I will define `AnotatedValue` by myself, and then define `analysis.binaryPre` to let `skip === true`, and perform calculation inside `analysis.binary` instead. Centainly, I will do this for all operations, not only binary operator.

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

However, such operation is still not perfectly correct. For example, `actual([AnnotatedValue(1337, true)])` will still give `[AnnotatedValue(1337, true)]` instead of `[1337]`, because `Array` is not an `AnnotatedValue` instance even if there is an `AnnotatedValue` instance as the array element. We need something that traverse the object recursively and replace all `AnnotatedValue` instances with their `value` fields, and recover them after operation is done. I will discuss this later when `strpTaints` and `mergeTaints` function implementations are covered.

## Location

Jalangi2 has provided an `iid` argument for each instrumentation callback function, which is the `Static Unique Instruction Identifier` that is used to specify the specific instruction that is being instrumented currently. It can also be used to specify the position of the instruction: `J$.iidToLocation(J$.getGlobalIID(iid))` is the code that can be used to get the position of current instruction being instrumented, where `J$` is a global variable used by `Jalangi2`. The returned position is a string, with format `[absolute path of js file]:[starting line number]:[starting column number]:[end line number]:[end column number]`. For example, if there is an assignment `a = b + c` at line 17, and at the callback instrumentation function of writing the value into `a` (e.i. `write`), the position being obtained will be `/path/to/file.js:17:1:17:2`, while `1` and `2` stand for `a` starts at column 1 and ends at column 2.

# Overall Design

//todo, because may modify in the future

# Design of Shadow Value

## Taint Information Variable

`Taint Information Variable` is used to record the taint state of basic variable types such as number and single character. I will discuss how taint information variable, which are used to describe basic type only, can be used to describe taint state of complex types such as `Object` in next subsection. In this subsection, I will discuss several design choices about taint information variable. 

### Boolean Variable

This is the simplest design: the shadow value is simply `true` or `false`. `true` if the variable is tainted, and `false` if the variable is not tainted. This is the easiest design choice to implement. In the following report, if I am going to make an example of `AnnotatedValue`, I will use this design choice in the example because this is simple and makes the example easy to understand.

### Boolean Array for Sources

User inputs of web page in browser can come from different sources. For example, user input can come from argument in URL and `<input>` HTML label. Because of that, it is necessary to be able to identify the source of the taint given a tainted variable. 

To implement this, we can use a boolean array, in which different indeces denotes taint state from different source. For example, element at index 0 can be taint state from source URL argument, while element at index 1 can be the taint state from `<input>` HTML label. If one array element at particular index is `true`, it means current basic variable is tainted by the source corresponding to that index. 

There is also an possible optimization: instead of using boolean array, we can use an integer instead, where each bit correspond to an original boolean variable in array. Such optimization saves space and time, but exerts limitation on number of sources: maximum 64 number of source if the integer is only 64-bit wide, for example.

### Boolean Array for Bits

Instead of having only one boolean variable for an integer, such array traces the taint information for every bit of the integer. This can be used to handle edge case of bit operation such as `&` and `|`. For example, the following code may cause false positive if we simply use a boolean variable to record the taint information.

```javascript
var t1,t2,r;
//`t1` and `t2` are tainted integer
t1 = t1 & 0xff;
t2 = t2 & 0xff00;
r = t1 & t2;
```

In this example, `r` must always be `0` whatever what `t1` and `t2` are, but if only a boolean variable is associated with the integer, false positive will be caused. If we taint the result as long as one of the operands are tainted (which is a common design), obviously `r` will be falsely tainted. However, if we trace the taint information at bit level, only` 0-7 bits` of `t1` and `8-15 bits` of `t2` are tainted at the final operation. Noting untainted bits to be all zeros, dynamic taint analysis can give the result that finally non of the bit in `r` is tainted.

Such boolean array can also be optimized to integer like `Boolean Array for Sources`. In addition, since such design is independent from boolean array for sources, they can be combined so that the `taint infomation variable` is a 2D boolean array, although sounds very expensive.

However, tracing at bit level is expensive and unnecessary. Cases like the example above rarely occur so it is not worthy to have such expensive design. To solve this problem without tracing taint infomration in bit level, we can log message when dynamic taint analysis is not sure about the result, and allow user customization about taint propagation rule for special cases, which will be covered later. //todo

### Taint Level

This is an "soft" version of boolean variable. Unlike //todo

### Symbolic Expression

This is actually not about taint analysis but about symbolic execution. //todo

## Shadow Value for Different Types

The `taint information variable` discussed in last subsection can only be used to describe basic types. However, we need to consider cases like `Object`, `Array` and `String` that are not appropriate to just have one `taint information variable`.

### String

The reason why it is not good to mark the whole string as tainted or not is that part of the string can be affected by user while part of the string cannot. For example, user can control the argument field of an URL, which should be marked as tainted, but cannot control the domain field, which should not be marked as tainted. Therefore, shadow value of `String` is an array of `taint information variable` whose length is same as the length of the string. For example, `AnnotatedValue("AABB", [true,true,false,false])` denotes that `"AA"` part is tainted but `"BB"` part is not tainted.

### Object and Array

Obviously it is not accurate to mark the whole object or array as tainted or not, because values stored in the object or array are independent and they can always be modified. For example, if `obj` is an `Object`, after executing `obj["a"] = "b"` and `obj["t"] = tainted_string`, using one `taint information variable` only, we cannot track taint states of these 2 fields independently. 

Therefore, the better design choice is to taint the values inside `Object` or `Array`, rather than taint the object or array itself as a whole. For example, if we have a array of integers and all of them are tainted, we do not taint the array to a `AnnotatedValue` with actual value as an array, but taint each individual elements such that the array becomes an array of `AnnotatedValue` with actual value as an integer (`[AnnotatedValue(1,true), AnnotatedValue(2,true)]` instead of `AnnotatedValue([1,2], true)`). 

Originally I employed such design. However, later on, I found that this design is still naive, so I then reconstructed my code. This problem is when the array is used in some operation, sometimes the taint information must be stripped before using the array. I will cover the detail about it later in *taint stripping and merging* subsection. Therefore, an alternative design is to still wrap the object or array with `AnnotatedValue`, but use an `Object` to describe taint state instead of a single `taint information variable`. Using the example above, in current design, we will have an `AnnotatedValue([1,2], {'0':true, '1':true})`. I will also discuss the details later.

Nonetheless, we cannot make key tainted, since in JavaScript only `String` or `Number` type is allowed to be used as key. Even if we assign value using `AnnotatedValue` as the key, it will still be casted to `String` before being used as key. However, the drawback is that sometimes key should have been tainted. For example, if argument passed to `JSON.parse` are a string that is totally tainted (e.i. every character is tainted including keys), the key should be tainted intuitively, but that's not the case in current design. Fortunately, usually websites will not use key to propagate information, so this drawback does not hurt so much.

Note that, since `null` is also an `Object`, so it would not be tainted.

### Basic types

For any other basic types, such as `Number` and `Boolean`, have shadow value with only one `taint information variable`. This includes the case like `undefined` and `NaN`.

### Function

Function variable is never tainted, since it is very rare for function to be controllable by user.

# Taint Analysis Implementation

JavaScript is a dynamic and weakly-typed language. Due to such feature, the taint analysis implementation is much more complicated than dynamic taint analysis over binary executables. In this section I will discuss my implementation for JavaScript, which I have employed in this project. 

## Taint Stripping and Merging

As I mentioned when discussing shadow value of object and array, there are 2 possible design choices: for example, we can have either `[AnnotatedValue(1,true), AnnotatedValue(2,true)]` or `AnnotatedValue([1,2], {'0':true, '1':true})`, where the second one is more favorable. However, even if second form is a more favorable design, sometimes the first form is easier to process. Therefore, we need some functions that enable us to switch between these 2 forms. To make it simple, I will call the first form as `merged form` and the second form as `stripped form` in the following section.

`Taint stripping` is the operation that *recursively* transforms the `merged from` to `stripped form`. I will explain what "recursively" means here later. If the merged form design choice is used for object and array variables (which is my original design), and when variable is used in JavaScript operations, the taint information must be stripped first to ensure the correctness of the result of JavaScript operations. These operations include JavaScript native function call and basic operator operation. The correctness of the operation can be affected by `merged form` as shown below.

```javascript
var arr;
//arr is [AnnotatedValue("AB", [true,false])]
arr += "C";
```

If `arr` variable is in merged form, `"[object Object]C"` will be the final result of `arr`, which is not correct, because dynamic taint analysis should not change the behavior of the program being analyzed, and the final result of `arr` should be `"ABC"` instead, as shown below.

```javascript
// new AnnotatedValue("AB", [true,false]) is essentially ["AB"]
> var arr = ["AB"] 
undefined
> arr += "C"
'ABC'
> arr
'ABC'
```

Therefore, to prevent such case from occurring, we need to *strip the taint information* (e.i. transform the variable to `stripped form`) to recover the original variable before putting them into JavaScript built-in operation. `JsTainter` has implemented a function called `stripTaints` to separate taint information and real value from a `merged form` variable. The return value is an object with `taints` field being `taint information` and `values` field being `real values`.

```javascript
//The way `stripTaints` function should be used
var v;
var sv = stripTaints(v);
sv.taints; //access taint part
sv.values; //access value part
var stripped_form = new AnnotatedValue(sv.values, sv.taints)
//convert it into `stripped form`
```

Here are some examples illustrating the effect of calling `stripTaints`. 

```javascript
//Example 1:// todo: make it a table
//before stripping
AnnotatedValue(1, true)
//after stripping
1
true

//before stripping
[AnnotatedValue("AB", [true, false])]
//after stripping
["AB"] // values
{'0':[true,false]} // taints

//before stripping
{i:new AnnotatedValue(1, true), u:1337,
    u2:AnnotatedValue(1337, false),
    o:{x:new AnnotatedValue(2, true), 
        a:[new AnnotatedValue("A", [true])]}}
//after stripping
{i:1, u:1337, u2:1337, o:{x:2,a:["A"]}} // values
{i:true, o:{x:true, a:{'0':[true]}}} // taints
```

When we strip the taint from a variable, it separates the real values and taint information into 2 different variables, and this is done recursively: if the variable is an object and there are more objects inside that object, objects inside the object are also stripped. If the original object is an `Object` or `Array` type, the basic structures of these separated variable are remained as original variable, which is illustrated well in the examples. 

Here is a few points to note: 

1. The original variable is an object, it is not cloned, and it will share the same reference as the `values` part. So, if the developer use the original object after `stripTaints` is called to it, the stripped object instead of the unstripped object will be obtained. 
2. Even if original structure is an `Array`, when it is separated into the taint part, it becomes an `Object` with numeric string as the key. The reason of this design is that if we keep it as `Array`, it will be confused with taint information of `String`, which is also an `Array`. The JavaScript feature that make this design proper is that `a[123]` and `a["123"]` will always be mapped to the same value, no matter `a` is a `Object` or an `Array`, so a number string as key will not cause any problem when we use key of different type to access the object. 
3. Recursion should not be applied to circular references, since that will cause infinite recursion. Instead, a stack that stores all current outer object references should be used to check the existence of circular reference, and if any, skip that variable without applying any recursion call to it.
4. As optimization, if a specific field of object or array is not tainted, corresponding field in taint information object will be simply `undefined` instead of `false`. In the third example, `u2` and `u` fields are both untainted, and in the taint object these 2 keys are simply undefined instead of having a `u2:false,u:false`.

Paired with `stripTaints` function, we also need to implement a `mergeTaints` function that transforms the `stripped form` to `merged form`. Here is the way to use this function.

```javascript
var stripped_form; // a stripped-form AnnotatedValue instance
v = mergeTaints(actual(stripped_form), shadow(stripped_form))
```

Similar to `stripTaints` function, there are also some points:

1. The result object being returned is not cloned from the input, but share the same reference as the first argument passed to `mergeTaints`.
2. Since for the untainted fields, corresponding field in shadow value (e.i. taint information of the object) is undefined, it is more efficient to traverse taint information object instead of real value object, and assign a newly created `AnnotatedValue` with shadow value fetched from taint information object to the corresponding field of real value object, if that field is tainted. 
3. Like `stripTaints`, circular reference is also checked and being prevented from infinite recursion.

### Implementation

//todo: maybe no todo

The implementation for `stripTaints` is clear and simple, we check the variable type first

## Result of Taint Analysis

Since dynamic taint analysis is a kind of analysis that gives the result of information flow of a particular program when it is run with some given input, we need some ways to represent such results. Here are my approach to record the results of the dynamic taint analysis.

### Tainted Variable Read and Write

`TaintAnalysis` class of `JsTainter` will maintain 2 objects as field that maps the location (which is obtained from `iid` and covered in last section) to the number of times this particular variable is read or write with taint. To be specific, `readRec` and `writeRec` are the fields to record taint variable read and taint variable write, respectively.  When value of some tainted variable is read or written, this corresponding key will be incremented. For example, if `a=b+c` at line 1 of `file.js` is executed and `b` is tainted, the value in `readRec["file.js:1:3:1:4"]` will be incremented. //todo, maybe add a figure

### Special Information

The special information is also one of the results of taint analysis, `logRec` field, to be specific. It is used to record special information that user might want to note about. For example, information could be recorded when tainted variable is used in a `if` statement. These information can help user to customize the taint propagation rule and make the analysis more accurate. User can also choose whether to record a particular type of special information by setting the configuration. The different types of special information will be covered later. Same as 2 fields above, the `logRec` also uses position as key, but the value is an array of string that recorded all messages being logged at this position.

## Binary Operators

In this subsection I will discuss taint propagation rule design for binary operator in this project. Because there is no operator overloads in JavaScript, the behaviors of binary operators are always certain.

### Add

In JavaScript, there are only 2 behaviors for `+` operator: **numeric plus** and **string concatenation**. However, according to different operand types, the behavior of `+` varies. Of course, when 2 operands are both `Number` the behavior is numeric plus, and when 2 operands are both `String` the behavior is string concatenation. However, since JavaScript is a weakly-typed language, we also need to also consider the case other than these two, such as when 2 operands are both `Object`. To make things clear, I have written a script that shows the behavior of `+` for different types of operands:

```javascript
function Test()
{
	this.t = 1;
}
var arr = [];
arr[0] = 1;
arr[2] = 4;
arr["a"] = 'b';
arr["c"] = new Test();
var typeVals = {str : "abc", numstr : "123", num : 123,
	undefined : undefined, null:null, bool : true, object : {a:1, b:1},
	objectTest: new Test(), arr : arr};

const print = (s)=>process.stdout.write(''+s);
const println = (s)=>print(s+'\n');

print('\"\",')
for (var t2 in typeVals)
{
	print('\"' + t2 + '\",');
}
println('');
for (var t1 in typeVals)
{
	print(t1 + ',');
	for (var t2 in typeVals)
	{
		var res = typeVals[t2] - typeVals[t1]
		var type = typeof res;
		print('\"' + type + ': ' + res + '\",');
	}
	println('');
}
```

//todo: add a picture

Opening the output as `.csv` file, we can clearly see that if both operands are among `number`, `undefined`, `null` and `boolean`, the result would be `number` type, so we can regard them as numeric add; for other cases, since the result is `string` type, so we can regard them as string concatenation. Even though we can handle all these edge cases, such edge cases rarely occur, so `JsTainter` would also record the messages into `logRec` to inform user when type of operand is any edge case.

For **Numeric Plus**, the rule is simple: the result is tainted if one of the operands are tainted. However, in some cases false positives may arise when both operands are tainted.

```javascript
var tainted_int; //number-type tainted variable
var zero = tainted_int + (-tainted_int);
```

Cases like this is unavoidable with pure taint analysis (e.i. without symbolic execution), but fortunately such case rarely occurs. My approach to handle such situation is to record into `logRec` if both operands are tainted in `+` operation and user chooses to record this in configuration.

**String Concatenation** will happen not only when 2 operands are `string` type, but will also happen when they are array or object, which makes things complex. The approach to solve this is to implement a function called `getTaintArray`, which takes a value with any type as input and returns the corresponding taint array if that value is casted to `String`. There are several cases to consider:

**String**

If the value is string, just return its shadow value directly, since nothing will change if it is used as string.

**Number, Boolean and Undefined**

In current implementation, the method is easy: if the shadow value is `true`, which means the variable is tainted, then every character is tainted when it is casted to `String`; if the shadow value is `false`, which means the variable is untainted, then every character is untainted when it is casted to `String`. However, drawback exists in such design: the string is tainted even if the string cannot be completely controlled by the user who provides the input. In other word, we lose the information that the string can only be partly controlled by user. If we are using this taint analysis to perform automatic vulnerability detection, this will cause false positive if the goal is to detect vulnerability such as `XSS`. For example, consider the following code:

```javascript
//variable `input` is tainted and can be controlled by attacker
var num = parseInt(input); 
document.write("Age: " + num);
```

The `num` must be a `number` type, and attacker can control it by controlling variable `input`. When `num` is converted to `string`, every character will be tainted according to the rule described above, then it is passed into `document.write`. If the rule that is used to detect vulnerability is to report the vulnerability as long as data passed into `document.write` is tainted, the false positive will be reported in this case. The reason is that even if the string converted from variable `num` is tainted, attacker cannot have full control of the string: attacker can only control the character ranging from `'0'` to `'9'`, so DOM-based XSS is not here. If we are using taint analysis to detect vulnerabilities, we may want to remove the taint as long as it is sanitized, or to use different taint value strategy such as `taint level` that has been discussed above. //When it is sanitized, the taint state will be somewhat different from the taint state before sanitizing.

**Array**

Before looking at how `getTaintArray` for `Array` type can be implemented, we may need to look at the behavior when `Array` is converted to `String`: when array is casted to string, every element is converted to string, and joined using `','`, for example

```javascript
> ''+[{a:1},1,"test", true, [1,4]]
'[object Object],1,test,true,1,4'
```

`{a:1}`, `1`, `"test"`, `true` and `[1,4]` are converted to string, then joined with `','` as separator. Note that the conversion of `[1,4]` to string is done recursively using the same way as the conversion of outter array.

However, there are serveral special cases to note. *Firstly*, array can also has `string` type as the key just like map type.

```javascript
> var a = []
undefined
> a[0] = 1
1 // assign to a integer index
> a[1] = 2
2 // assign to another integer index
> a[-1] = -2
-2 // assign to a negative integer
> a["key"] = "test"
'test' // assign to a string key 
> a[a] = 5
5 // assign to a array key
> a[{}] = 'obj'
'obj' // assign to a object key
> a[10000000000000000000000000000000000000000000000000000000]='big'
'big' // assign to a large integer
> a[0.1] = 0.1
0.1 // assign to a floating point number
> a
[ 1,
  2,
  '-1': -2,
  key: 'test',
  '1,2': 5,
  '[object Object]': 'obj',
  '1e+55': 'big',
  '0.1': 0.1 ]
/*except 0 and 1, everything else is converted to string before being used as key*/
> ''+a
'1,2'
/*however, when casted to String, value inside string key will not be used*/
```

However, as shown clearly above, these value bounded with `string` key will not contribute when the array is converted to `string`, and any type other than positive small integer will be converted to `string` as key.

*Secondly*, `null`, `undefined` and circular reference will not be converted to string, but will be an empty string.

```javascript
> var a = []
undefined
> a
[]
> a[0] = "first"
'first'
> a[2] = "2"
'2'
> a[3] = undefined
undefined // assign `undefined` to index 3, also index 1 is not assigned so it's also undefined
> a[4] = "4th"
'4th'
> a[5] = null
null // assign `null` to index 5
> a[6] = 'six'
'six'
> a[7] = a //assign circular reference at index 7
[ 'first', , '2', undefined, '4th', null, 'six', [Circular] ]
> ''+a
'first,,2,,4th,,six,'
/*cast to string, obviously `null`, `undefined` and circular reference is empty string*/
```

If the index is never assigned or has value `undefined`, `null` or circular reference, it will simply be converted to empty string. The way to define circular structure is when an element is the reference to any outter arrays, for example:

```javascript
> a = []
[]
> a[0] = []
[]
> a[0][0] = a // assign circular reference, although not direct circular reference
[ [ [Circular] ] ]
> a[0][1] = a[0] // assign direct circular reference
[ [ [Circular] ], [Circular] ]
> a
[ [ [Circular], [Circular] ] ]
// first circular is `a`, second circular is `a[0]`
```

*Thirdly*, we need to note `Array.prototype`. Assigning value to prototype is also a way to set the index of array, but this is for all `Array` instances.

```javascript
> var a = []
undefined
> Array.prototype
[]
> Array.prototype[0] = 1
1
> a.length
0 // array prototype will not make the array longer
> ''+a
'' // array prototype will not contribute when casted to string if the length <= index of prototype
> a[2] = 2
2
> a.length
3
> ''+a
'1,,2' // however, prototype will contribute if length > index of prototype
```

Luckily, value in `prototype` will also contribute when an array is converted to string, but only if within the range of `a.length`. Therefore, this does not affect our implementation so much. 

Considering these factors, we can implement the function that obtain the taint array when an JavaScript `Array` is converted to string. We iterate over array using for loop bounded by `length`, convert elements to taint array by using recursion call if necessary, and `concat` them together; the `','` in between is always untainted.

### Binary Arithmetic Operator

Binary arithmetic operators are operators like `-`, `*`, `/` and `%`. If both operands are numeric, dynamic taint analysis rule can work easily: the result is tainted as long as one of the operands is tainted. But types other than `Number`, things become hard to analyze. Therefore, to inform user, `JsTainter` would record the message into `logRec` when the type of operand is something other than number. Here are the tables that show all possible combinations of different types of operands for different arithmetic operators.

//todo: table

It is obvious that as long as one of the operands is `Object`, the result is always `NaN`. Since in our design, `Object` instance is never tainted (note: but value inside them could be tainted), the result should also always be untainted as long as one of the operands is `Object`. 

Another possible situation is when the operand is string. When `string` is used as operand of arithmetic operation, it will be converted to number first before doing arithmetic operation except `+`.

```javascript
> "3"/10
0.3
> "3" - "10"
-7
> "3" + "10"
'310' // only `+` will perfrom string concat
```

The result should not be tainted if the string is always converted to `NaN` no matter how tainted characters changed. For example, `AnnotatedValue("a123", [false,true,true,true]) - 0` should be untainted, because no matter how last 3 characters are changed, the result will always be `NaN` due to the existence of `'a'` at index 0; and `AnnotatedValue("1ea", [false,false,true]) - 0` should be tainted, because if we change last `'a'` to a number such as `'1'`, the result will not be `NaN` but something we can control.

My approach to detect if the numeric result is actually controllable is to replace all tainted characters by number characters such as `'0'`, then try to convert the string to number. If it is still `NaN`, the result should not be tainted; if it becomes a number, the result should be tainted. However, even with such careful design, false positive could still come up. For example:

```javascript
var b; 
// `b` is a tainted variable, but is always boolean
var i;
// `i` is a tainted variable, but is always integer
var r = String(b) - i;
// characters in String(b) are all tainted
// `r` is always NaN no matter what `b` and `i` are
// but it will be marked as tainted
```

Case like this is unavoidable, unfortunately.

### Shift operator

Shift operators are `<<`, `>>` and `>>>`. The taint propagation rule for shift operator can also be similar to arithmetic ones: result is tainted if one of the operands are tainted. However, special cases are a bit different: 

1. The result is not `NaN` if there is any `NaN` among operands. Instead, the value that would be evaluated to `NaN` will be regarded as `0`. 
2. If the left hand side is always evaluated to 0 (e.g. including `NaN` case), the result should be untainted since result is always `0` no matter how operand at right hand side changes.

```javascript
> 123 << "asc"
123
> "asc" << 42
0
> 123 << {}
123
> 123 << [1,2]
123
// operand that will be casted to NaN will be regarded as 0
> 123 << [1]
246
```

Here is the table that shows all possible combinations of different types.

//todo add table

### Boolean Operator

There are two types of boolean operators: comparison such as `==`, `<` and `>`; logic such as `&&` and `||`. 

For comparison, the taint propagation rule is still same: taint the result if one of the operands is tainted. However, for expression like `tainted == tainted`, where `tainted` is a tainted integer, the result is always true regardless how variable `tainted` changes, but it will still be marked as tainted according the current rule design. Fortunately, situation like this rarely occurs in real program.  

For logic, Jalangi2 will simply treat it as conditional expression: therefore, these operators are not treated as binary operators but as conditional jumps. They would not cause `binaryPre` and `binary` handlers to be called, but would cause `conditional` handler to be called. For example, `a && b` will be translated to `a ? b : a`, therefore not a binary operator at all.

### Bit-wise Operator

As I suggested in last section, if bit-wise taint tracing is used, taint tracing will much more accurate here. However, since this is not necessary, we do not employ such design. Instead, we treat it in the same way as comparison operators like `==`. Except for `&` operation, where if one of operands would always be evaluated to 0, the result will also always be 0, so we mark the result as untainted no matter another operand is tainted or not.  



## Put and Get Field

### Overview

`getField` is a JavaScript operation that obtains array element, object field, and character in string. Let's look at the behavior of **object** first.

```javascript
> a = {}
{}
> a["qwer"] = 1
1 // put field
> a.qwer
1 //a["qwer"] is equavalent to a.qwer
> a
{ qwer: 1 }
```

As shown above, `a["xxx"]` and `a.xxx` both give same behavior. In addition, there are also some edge cases as always, for example:

```javascript
> a = {}
{}
> a[1] = '1'
'1'
> a[{}] = 'obj'
'obj' // {} will be casted to string first before used as key
> a['1']
'1' //a['1'] is equavalent to a[1], for the same reason
> a[[[1]]]
'1' //[[1]] will be casted to string first, which is '1'
> a['0x1']
undefined //'0x1' cannot be casted to 1
> a
{ '1': '1', '[object Object]': 'obj' }
```

When the key is something other than string, it will be converted to string first, then used as the key to obtain the value.

The behavior of **array** is almost identical to object, except number keys are treated specially.

```javascript
> a = []
[]
> a[0] = 0
0
> a[3] = 3
3
> a.length
4 // the length is dependent on largest index being assigned
> a["qwer"] = 's'
's' // assign using string as the key
> a[{}] = 'obj'
'obj' //{} will also be casted to string first
> a[[[["qwer",]],]]
's' //same, casted to string before used as key
> a['0']
0 //a['0'] is equavalent to a[0], which means numeric string will be casted to int
> a[new String('0')]
0 //new String('0') behave same as '0'
> a['0x0']
undefined
> a[[[[0]]]]
0
> a[[[['0']]]]
0
> a[NaN]
undefined
> a
[ 0, , , 3, qwer: 's', '[object Object]': 'obj' ]
```

Unlike some other languages, in JavaScript, you don't get array out of bound when assigning the array with out-of-bound index; instead, the array is extended automatically. Also, we can also have string as the key in array, and things that is neither `String` nor `Number` will be converted to string automatically. However, `Number` type has priviledge: as long as a string is a numeric integer string, it will be regarded as integer instead of string. In other word, there is no numeric string key in `Array`, because they will all be regarded as numeric index.

**String** is similar to array in how it handles the numeric string, but it does not have string as the key, and it remain unchanged when `putField` is applied.

```javascript
> a = "qwer"
'qwer'
> a[1]
'w'
> a['1']
'w' // numeric string will be treated as integer
> a[[[['1']]]]
'w' // cast to string first before used as key
> a[4] = 'k'
'k'
> a[0] = 'k'
'k'
> a
'qwer'
> a['qwer']
undefined
```

For **other types**, they all return `undefined` and  remain unchanged when `getField` and `putField` respectively. However, there are some buit-in fields like `__proto__`, which is also the case for 3 types covered above.

```javascript
> x = 0x100
256
> x["test"] = 'test'
'test'
> x.test
undefined
> x.__proto__
[Number: 0]
```

### Taint Analysis Rule

For `getField`, the current design is to return the same thing as the value corresponding to the key. Therefore, if the element being fetched is tainted, the result is tainted; otherwise, the result is not tainted. The rule is same for the case of `String` type, but the implementation is a bit different due to different structures. For example, an tainted array `[1,2]` would have structure `[AnnotatedValue(1,true), AnnotatedValue(2,true)]`, while an tainted string `"12"` would have structure `AnnotatedValue("12", [true,true])`. If we fetch index 0 (e.i. `a[0]`), the array one should give `AnnotatedValue(1,true)` which can be obtained through directly accessing that array, while the string one should give `AnnotatedValue("1", [true])`, whichi need us to fetch index 0 from both `value` and `shadow` fields and puts them into an newly created `AnnotatedValue`.

For `setField`, the current design is to directly assign the value to corresponding key.

However, such rules may give false negatives. For example, when `base64` is implemented, a index that might be tainted is used to access a constant `base64` array. The result should be tainted since there is information propagation, but if we ignore the taint state of index the result will be untainted since the array itself is not tainted, which is false negatives. To mitigate such error, we can let user know when a tainted key is used to access an `Object`, and enable user to custom taint propagation rule, which will be covered later. //todo 

## Native Function Call

### Native Function Recognition

The native functions are JavaScript built-in functions. These do not have to be functions defined in JavaScript standard, but can also be some environment dependent functions, such as DOM APIs. For example, `alert` is a built-in function when JavaScript is running in the browser, and `Number` is a built-in function defined in JavaScript standard that should works fine in all JavaScript implementations.

Therefore, we need to check if a particular function is a native function or user-defined function. After some [investigation](https://davidwalsh.name/detect-native-function), I found that I can convert the function into string by built-in `Function.prototype.toString` function, and then check the result string. If the string is in the form like `"function funcName() { [native code] }"`, it is obvious that the function is a native function. We can check this by regular expression.

```
/function a-zA-Z_()[ \t\n]{[ \t\n][native code][ \t\n]}/
```

//todo: may delete this Note that the reason why I choose `Function.prototype.toString` is to prevent the case when `toString` of the object . The reason is that the code that `JsTainter` is analyzing might be malicious. It can rewrite the `toString` method of the variable being called as function, so that the identification of native function might not work as expected, and this might also cause security issue. The example of this kind of attack is shown below.

```javascript
var f = {};
f.toString = function () {return "hacked"}
f();
```

### Native Function Call Handler

In `Jalangi2` framework, we can set `invokeFunPre` and `invokeFun` fields of `analysis class` as function handlers, and they will be called before and after any function call is made in the program being analyzed, respectively. In `invokeFunPre`, nothing is implemented, but set the `skip` field of return value as `true`. By setting this field, `Jalangi2` will not perform the function call anymore. This is the desired behavior because assigning the work to `Jalangi2` will give the wrong result since the arguments are not stripped. Thus, instead, the function is called in `invokeFun` handler by `JsTainter`.

In `invokeFun` handler, we firstly check if `f` (the variable being called) equals to specific strings, if so, some assertion function is called. This piece of codes is used for testing purpose, which will be covered in subsequent section, but this code will be removed in the final product. Then we try to check if the function is native function. If it falls into the category of native function, a big `switch` statement will be used to check which native function `f` is , and jump to the corresponding case handler, in which the taint propagation logic and actual function call are implemented for that particular native function.

### Native Function Rules

In this subsubsectinon I will cover the detail of handler for each different native function.

**String.prototype.substr**

The `substr` function, as its name suggests, takes the sub-string of given string. The first argument is the index and the second argument is length. However, there are some special cases. 

*Firstly*, the input string does not have to be string type: if a variable other than string type is passed as the `this` argument, it will be converted into string first before applying `substr` operation. We can use `getTaintArray` that we implemented before to get the taint array when the variable is converted into `String`, and this problem can be solved.

```javascript
> String.prototype.substr.apply(123456789, [2,3])
'345' // 123456789 will be converted to '123456789' first
> String.prototype.substr.apply({}, [2,10])
'bject Obje' // {} will be converted to '[object Object]' first
> String.prototype.substr.apply([1,2,3,4,5,6,7,8], [2,3])
'2,3' // the array will be converted to '1,2,3,4,5,6,7,8' first
```

*Secondly*, index can be negative, and when it is negative, it will start from the end (e.i. `-x` has same effect as `length-x`). Also, index and length does not have to be `Number`; if they are not `Number`, they will be converted to `Number` first. When they are evaluated to `NaN`, they will be regarded as `0`.

```javascript
> "abcdefghij".substr(-3,2)
'hi'
> "abcdefghij".substr("abcdefghij".length-3,2)
'hi'
//case of negative index
> "abcdefghij".substr(-100, 3)
'abc'
//but index will be regard as 0 if index < -length
> "abcdefghij".substr(NaN, 3)
'abc'
> "abcdefghij".substr({}, 3)
'abc'
//anything that will be converted to NaN will be regarded as 0
> "abcdefghij".substr([[[3]]], [3])
'def'
> "abcdefghij".substr('3', '3')
'def'
//anything that will be casted to numeric string will be regarded as number
```

When `substr` is handled, we must also slice the taint array in the same way as `substr`. For example, for a string `AnnotatedValue("AABB", [true,true,false,false])`, and `substr(1,2)` is applied, the result should be `AnnotatedValue("AB", [true,false])`. However, if we use `Array.prototype.slice` to slice the taint array of string in `substr` operation, we will have too many cases to consider. Thus, I came up with a quick and dirty way to implement it: the taint array can be converted to string first, then apply the `substr` with the same argument, and finally convert it back to taint array. I have implemented a function called `taintArrToStr`. In this function, for each character of the result string, the Unicode value is the index to the taint array, so what this function actually does is to generate a string with same length and characters with ascending values starting from `'\u0000'`. Another function that I have implemented is `strToTaintArr`. This function is called after `substr` is applied: the Unicode values are used as indexes to fetch the taint array elements, which are joined together to be the result. A piece of code may illustrate my idea better.

```javascript
> var s = taintArrToStr([true, false, true, false])
> s
"\u0000\u0001\u0002\u0003"
> s = s.substr(1,1)
"\u0001\u0002"
> strToTaintArr(s, [true, false, true, false])
[false, true]
```

However, the disadvantage of this approach is that the maximum length of string cannot exceed 65536, the max value of numeric value of character, but fortunately string with such big size rarely occurs.

**Number**

This function convert variable to `Number`, we can just use `rule.compressTaint` to obtain the result taint if the variable will not always evaluated to `NaN`. Stripping and merging are also required before feeding arguments into `Number.apply`. The logic is almost same in arithmetic taint propagation handler.

**String.prototype.charAt**

This function obtains the character at given index, which should return the same taint information as that of character at that index. For example, `charAt(1)` of `AnnotatedValue("ABCD", [true,false,true,true])` should be `AnnotatedValue("B", [false])`.

However, there are some special cases. The `this` argument does not have to be string type, so `getTaintArray` need to be used to get the taint array if the value is cast to string. Also, as always, the variables are stripped first before being putting into the native function.

There are also cases where the index is tainted, but the characters in string are not tainted. In this case we need to give user option to choose if the result should be tainted. //todo

**String.prototype.charCodeAt**

This is similar to `chatAt`, except that the ascii value will be returned, so the taint information at that index will also be returned as shadow value. For the same example, `charCodeAt(1)` of `AnnotatedValue("ABCD", [true,false,true,true])` should be `AnnotatedValue(0x42, false)`.

**String.fromCharCode**

This function convert the integer to string of length 1 whose unicode value is same as the given index. For example, `String.fromCharCode(0x41)` will give `"A"`. The result taint information is same as the taint value of given argument. However, the given argument does not have to be `Number`. They can be some other types.

```javascript
> String.fromCharCode([[0x41]])
'A'
> String.fromCharCode({a:0x41})
'\u0000'
> String.fromCharCode('0x41')
'A'
> String.fromCharCode(null)
'\u0000'
> String.fromCharCode('0x41\u0000')
'\u0000'
```

Therefore, we need to call `compressTaint` to the shadow value of given input. Also, if the argument always evaluates to `NaN` no matter what tainted parts are, the return value, which is `'\u0000'`, should not be tainted. For example `String.fromCharCode(AnnotatedValue('0x41\u0000', [true,true,true,true,false]))` will stil return `AnnotatedValue('\u0000', [false])`.

**String.prototype.concat**

This is almost same as the `+` operation as string concatention. However, the difference is that this function can concat serveral strings together.

```javascript
> "abc".concat("def", "ghi", "jk")
'abcdefghijk'
> "abc".concat({}, 123, [2,3])
'abc[object Object]1232,3'
```

Thus, we need to concat all taint array together, using `Array.prototype.concat`.

**escape**

This is the function that converts the string into URL encoding if necessary.

```javascript
> escape("abc\"\'<>\ucccc")
'abc%22%27%3C%3E%uCCCC'
```

There are 3 cases: if the character does not have to be converted into URL encoding, it will be left unchanged; if the character need to be encoded but is smaller than `0x100`, it will be converted to `%XX`; if the character need to be encoded but is larger than `0x100`, it will be converted to `%uXXXX`. For the first case, the taint information is left unchanged; for the second case, the taint information is copied 3 times; and for the third case, the taint information is copied 6 times.

### Rules of Different Native Functions

In this subsubsection I will cover the design of rules

### User Defined Function Call

### Constructor

todo, there are some wired behavior

### SandBox

What if the codes being analyzed is malicious and want to gain previlidge? e.g. define another `AnnotatedValue` class, or defined a function with same name as function in `Analyzer`, but this seems to be already solved by `Jalangi`

## Log

In some cases that the dynamic taint analysis might fail to work, information should be presented to user that the code here might cause inaccurate result.

### Arithmetic Operation

In current design, we taint the result as long as one of the argument 

# Test

To have proper software engineering design, I have written test cases to ensure the analysis is running correctly. However, the approach to test is somewhat different from normal program. Since the `JsTainter` heavily relies on `Jalangi2` framework, it's quite hard to simply import the taint analysis unit and perform unit testing only on that unit. The reason is that `Jalangi2` has done many things for `JsTainter`, and `JsTainter` does not work without this framework.

Therefore, instead, I have formulated a way to perform testing. Since we can instrument the JavaScript program that the analysis is running on, we can instrument on function call to perform our assertion.

```javascript
var a; //something whose taint state is to be examined
const assertTaint = "assertTaint";
assertTaint(a, true);
```

The codes above will simply throw an exception in normal execution. However, if it is instrumented by our analysis program, we can examine the value of `function` parameter in the function call instrumentation callback. This value should be a `function` type variable in normal case, but if it is a `string` type variable and has value `"assertTaint"`, then we know we are going to perform assertion against the taint state of given variable, instead of executing the function call that will throw the error.

```javascript
function assertTaint(val, taint)
{
	//...implement the assertion logic here
}
//in the instrumentation callback handler of function call
if (f === 'assertTaint')
{
	assertTaint(args[0], args[1]);
}
```

Note that these 2 pieces of codes are in different files. The first code piece is in the JavaScript file that is going to be analyzed (e.i. `test.js`); while the second code piece is in the file that performs the dynamic taint analysis (e.i. `DynTaintAnalysis.js`) . Therefore, even if we have same `assertTaint` name as identifier in both files, there will not be any conflict.

1. report for ALL DTA algorithm

   log and config and if necessary, record, which shold ALL be inside `TaintLogic`

2. add other operation handling if they are commonly used in real world

   e.g. getfield, other native functions, e.g. String/Numer/Array/JSON methods

3. 