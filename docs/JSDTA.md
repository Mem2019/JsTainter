---
layout: post
title:  "Reflection about JavaScript Taint Analysis"
date:   2019-04-29 01:01:05 +0000
categories: jekyll update
---

# Overview

Unlike binary program, whose behavior is simple and easy to analysis, JavaScirpt is highly dynamic and very complex, thus hard to analysis. I will cover possible implementations of data structure of shadow value along with JavaScript variable, and their pros and cons. Also, here is some of my reflection about the cases that we need to consider when implementing dynamic taint analysis for JavaScript, possible ways to deal with them, and the drawbacks of these approaches.

#Jalangi2

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

`Shadow Value` is a concept formulated in [Jalangi paper](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.455.9073&rep=rep1&type=pdf). The key point is that there could be another shadow value associated with a variable. In the paper, `AnnotatedValue` class is used to denote the variable that has any shadow value along with it. The `value` field of this class is the original value of this variable, while `shadow` field is the shadow value associated with this variable. For example, if an integer variable `1337` has shadow value `true`, the variable will be an `AnnotatedValue` object with field `value` being `1337` and field `shadow` being `true`, denoted as `AnnotatedValue(1337, true)` (I will use this notation in the following report). This shadow value concept is important because `JsTainter` will use shadow value to record the taint state information about a variable, which is neccessaty in dynamic taint anaysis.

However, I found that mechanism of shadow value of `Jalangi2`, works differently from the one mentioned in this [paper](https://people.eecs.berkeley.edu/~ksen/papers/jalangi.pdf). The reason might be that the version is different: the paper covers `Jalangi1` while I am using `Jalangi2`. Of course, `JsTainter` can use `Jalangi1` instead of `Jalangi2`, but `Jalangi1` has not been maintainted for many years, so using `Jalangi1` may have more risk of encountering bugs in the framework.

In the paper (`Jalangi1`), it is suggested to use a `AnnotatedValue` to replace some variables, just as I discussed above, and as long as the variable is used for some operation, `actual(value)` is used to convert it to actual value for operation. For example, `actual(AnnotatedValue(1337, true)) === 1337`.  Then when our analysis callback function `analysis.binary` is called, `value` is passed as the arguments instead of `actual(value)`. The logic is shown as below, according to the seudo-codes in the paper.

```javascript
//definition of AnotatedValue
function AnotatedValue(val, shadow)
{
	this.val = val;
	this.shadow = shadow;
}
function actual(val)
{
	return val instanceof AnotatedValue ? val.val : val;
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

However, such operation is still not perfectly correct. For example, `actual([AnnotatedValue(1337, true)])` will still give `[AnnotatedValue(1337, true)]` instead of `[1337]`, because `Array` is not an `AnnotatedValue` instance even if there is an `AnnotatedValue` instance as the array element. We need something that traverse the object recursively and replace all `AnnotatedValue` instances with their `value` fields, and recover them after operation is done. I will discuss this later when `strpTaints` and `mergeTaints` function implementions are covered.

# Overall Design

//todo, because may modify in the future

# Design of Shadow Value

## Taint Information Variable

`Taint Information Variable` is used to record the taint state of basic variable types such as number and single character. I will discuss how taint information variable, which are used to describe basic type only, can be used to describe taint state of complex types such as `Object` in next subsection. In this subsection, I will discuss several design choices about taint information variable. 

### Boolean Variable

This is the simplest design: the shadow value is simply `true` or `false`. `true` if the variable is tainted, and `false` if the variable is not tainted. This is the easiest design choice to implement.

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





 we can simply use a `boolean` to represent taint state, in which `true` means `tainted` and `false` means `not tainted`; we can also use an `boolean array` to represent taint state, in which boolean variables at different indeces represent taint state from `different taint sources`. The second approach provides more information but harder to implement. To make it more convinient, I will call such boolean variable and boolean array variable as `taint infomation variable`.

## Shadow Value for Different Types

Then I will discuss design choice(s) of different types of variables in JavaScipt. 

## Number

The number includes `int` and `float` in JavaScript. Its shadow value is one taint information variable. It is also possible to trace the taint information for each bit?

## String

The string is a sequence of characters. Its shadow value is an array of taint information variable whose length is same as the length of the string.

## Object and Array

One design choice for these is never taint the object itself, but taint the elements or fields inside the array or object. For example, if we have a array of integers and all of them are tainted, we do not taint the array to a `AnnotatedValue` with actual value as an array, but taint each individual elements such that the array becomes an array of `AnnotatedValue` with actual value as an integer. However, here is a drawback of this degisn, which might cause false negative: the key is never tainted.

Array to string == `.join(',')`

## Boolean

This type of variable can be dealed in the same way as number. When bool converted to int, taint level?

## NaN, undefined, and null

These are some special cases. 

Firstly, `typeof NaN === 'number'`, so maybe this can be dealed in the same way as number. 

Secondly, `undefined` will be produced when a variable or a field is not defined. We could never taint it, or also treat it in the same way as number, depending on the design choice. //todo

Thirdly, since `typeof null === 'object'`, and `Object` is never tained as I mentioned above, `null` will not be tained either.

## Function

I don't think it is possible for a function to be tainted, so let's leave it to be `never tainted`.

## Others

Taint degree?

# 0x02 Taint Propagation Rule

Due to the dynamic and weakly-typed feature of JavaScript, the taint propagation rule is much more complicated than dynamic taint analysis over binary executables.

## Taint Stripping and Merging

When variable is used in JavaScript operations, the taint information must be stripped first to ensure the correctness of the result of JavaScript operations. These operations include JavaScript native function call and basic operator operation. The correctness of the operation can be affected as shown below.

```javascript
var arr;
//arr is [new AnnotatedValue("AB", [true,false])]
arr += "C";
```

If the tainted information is not tripped from the `arr` variable, `"[object Object]C"` will be the final result of `arr`, which is not correct, because dynamic taint analysis should not change the behavior of the program being analyzed, and the final result of `arr` should be `"ABC"` instead, as shown below.

```javascript
// new AnnotatedValue("AB", [true,false]) is essentially ["AB"]
> var arr = ["AB"] 
undefined
> arr += "C"
'ABC'
> arr
'ABC'
```

Therefore, to prevent such case from occuring, we need to strip the taint information to recover the original variable before putting them into JavaScript built-in operation. For example, 

```javascript
//The way `stripTaints` function should be used
var v;
var sv = stripTaints(v);
sv.taints; //access taint part
sv.values; //access value part

//Some examples
//before stripping
[new AnnotatedValue("AB", [true, false])]
//after stripping
["AB"] // values
{'0':[true,false]} // taints
//before stripping
{i:new AnnotatedValue(1, true), 
    o:{x:new AnnotatedValue(2, true), 
        a:[new AnnotatedValue("A", [true])]}}
//after stripping
{i:1, o:{x:2,a:["A"]}} // values
{i:true, o:{x:true, a:{'0':[true]}}} // taints
```

The example above is clear. When we strip the taint from a variable, it separates the value part and taint part into 2 different objects, while the keys are the same but the values are different, and this is done recursively: any object inside the object is also stripped. Here is a few points to note: 1. The original object is not cloned, and it will share the same reference as the `values` part. So, if the developper use the original object after `stripTaints` is called to it, he will get the stripped object instead of the unstripped object. The example is shown in //todo. 2. Even if original structure is an `Array`, when it is separated into the taint part, it becomes a `Map` with number string as the key. The reason of this design is that if we keep it as `Array`, it will be confused with taint information of `String`, which is also an `Array`. Also, `a[123]` and `a["123"]` will always be mapped to the same value, no matter `a` is a `Map` or an `Array`, so a number string as key will not cause any problem when we use key of different type to access the object. 3. Recursion should not be applied to circular references, since that will cause infinite recursion. Instead, a stack that stores all current outter object references should be used to check the existence of circular reference, and if any, skip that variable without applying any recursion call to it.

```javascript
var obj; //some object that is tainted
var sobj = stripTaints(obj);
//using obj will get the stripped version
```

Paired with `stripTaints` function, we also need to implement a `mergeTaints` that recovers the taint information separated by `stripTaints`. The way to use it is shown below.

```javascript
v = mergeTaints(sv.taints, sv.values)
```

### Implementation

//todo, but I don't think there is any to say, "talk is cheap, show me the code"

 

## Binary Operators

### Add

Since there is no overloading operator in JavaScript, there are only 2 functionalities for `+` operator: *numeric plus* and *string concatination*. I have written a script that shows the behavior of `+` for different types:

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

Opening the output as `.csv` file, we can clearly see that if both operands are among `number`, `undefined`, `null` and `boolean`, the result would be `number` type, so we can regard them as numeric add; for other cases, since the result is `string` tyoe, so we can regard them as string concatenation. For string concatination, this will happen not only when 2 operands are `string` type, but will also happen when they are array or object, which makes things complex. The approach to solve this is to implement a function that takes a value as input and returns the corresponding taint array if that value is converted to string. The argument value does not have to be `actual value` (e.i. can be `AnnotatedValue`). There are serveral cases to consider:

**String**

If the value is string, just return its shadow value directly, since nothing will change if it is used as string.

**Number, Boolean and Undefined**

In current implementation, the method is easy: if the shadow value says the value is tainted, then every character is tainted when it is converted to `string`; if the shadow value says the value is untainted, then every character is untainted when it is converted to `string`. However, such design has drawbacks: the string is tainted even if the string cannot be completely controlled by the user who provides the input, and this will cause false positive if the goal is to detect vulnerability such as `XSS`. For example, consider the following code:

```javascript
//variable `input` is tainted and can be controlled by attacker
var num = parseInt(input); 
document.write("Age: " + num);
```

The num must be a `number` type, and attacker can control it by controlling variable `input`. When `num` is converted to `string`, every character will be tainted according to the rule described above, then it is passed into `document.write`. If the rule that is used to detect vulnerability is to report the vulnerability as long as data passed into sink is tainted, the false positive will be reported in this case. The reason is that even if the string converted from variable `num` is tainted, attacker cannot have full control of the string: attacker can only control the character ranging from `'0'` to `'9'`, so DOM-based XSS is not here. If we are using taint analysis to detect vulnerabilities, we may want to remove the taint as long as it is sanitized, or to use different taint value strategy that can specify different `taint level` (e.g. use `enum` instead of `boolean`). When it is sanitized, the taint state will be somewhat different from the taint state before sanitizing.

**Array**

When array is converted to string, every element is converted to string, and joined using `','`, for example

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
1
> a[1] = 2
2
> a[-1] = -2
-2
> a["key"] = "test"
'test'
> a[a] = 5
5
> a[{}] = 'obj'
'obj'
> a[10000000000000000000000000000000000000000000000000000000]='big'
'big'
> a[0.1] = 0.1
0.1
> a
[ 1,
  2,
  '-1': -2,
  key: 'test',
  '1,2': 5,
  '[object Object]': 'obj',
  '1e+55': 'big',
  '0.1': 0.1 ]
> ''+a
'1,2'
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
undefined
> a[4] = "4th"
'4th'
> a[5] = null
null
> a[6] = 'six'
'six'
> a[7] = a
[ 'first', , '2', undefined, '4th', null, 'six', [Circular] ]
> a
[ 'first', , '2', undefined, '4th', null, 'six', [Circular] ]
> ''+a
'first,,2,,4th,,six,'
```

If the index is never assigned or has value `undefined`, `null` or circular reference, it will simply be converted to empty string. The way to define circular structure is when an element is the reference to any outter arrays, for example:

```javascript
> a = []
[]
> a[0] = []
[]
> a[0][0] = a
[ [ [Circular] ] ]
> a[0][1] = a[0]
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
0
> ''+a
''
> a[2] = 2
2
> a.length
3
> ''+a
'1,,2'
```

Luckily, value in `prototype` will also contribute when an array is converted to string, but only if within the range of `a.length`. Therefore, this does not affect our implementation so much. 

Considering these factors, we can implement the function that obtain the taint array when an JavaScript `Array` is converted to string.

//todo: maybe add some codes here? 

### Binary Arithmetic Operator

It works fine for both operands to be numeric: the result is tainted as long as one of the operands is tainted. But for other types, it becomes hard to analyze. Here are the tables that show all possible combinations of different types of operands for different arithmetic operators.

//todo: table

It is obvious that as long as one of the operands is `object`, the result is always `NaN`. Since in our design, `Object` instance is never tainted (note: but value inside them could be tainted), the result should also always be untainted as long as one of the operands is `Object`. 

Another possible situation is when the operand is string. When `string` is used as operand of arithmetic operation, it will be converted to number first before doing arithmetic operation except `+`.

```javascript
> "3"/10
0.3
> "3" - "10"
-7
> "3" + "10"
'310'
```

If the string will be converted to `NaN`, the result will always be `NaN`. The result should not be tainted if the string is always converted to `NaN` no matter how input is changed. My approach to deal with it is to convert all tainted characters to `'0'` or any other number, then try to convert the string to number. If it is still `NaN`, the result should not be tainted, since the result is unaffected by user input; if it becomes a number, the result should be tainted. However, even with such careful design, false positive could still come up. For example:

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

If the operands do not always give `NaN`, we apply the arithmetic taint propagation rule: result is tainted as long as one operand is tainted. 

### Shift operator

In the shift operator, the value that would be evaluated to `NaN` will be regarded as `0`.

```javascript
> 123 << "asc"
123
> "asc" << 42
0
> 123 << {}
123
> 123 << [1] //todo, this case seems to also works for arith
246
> 123 << [1,2]
123
```

Here is the table that shows all possible combinations of different types.

//todo add table

Therefore, as long as LHS will be evaluated to `NaN`, the result is untainted; otherwise, the result is tainted according to arithmetic operation rule.

### Boolean Operator

This is even complicated, and could easily produce false negatives/positives; also when `==` is used, things will get more complicated. In addition, for `||` and `&&`, we also need to consider the case when operands are not boolean... For example, `("a" || "b") === "a"` 

### Bit-wise Operator

The problem is not only false positives that will be produced if bit-wise taint information is not used, we may also need to consider cases like `"a" | "b"`



## Put and Get Field

### Overview

`getField` is a JavaScript operation that obtains array element, object field, and character in string. Let's look at the behavior of **object** first.

```javascript
> a = {}
{}
> a["qwer"] = 1
1
> a.qwer
1
> a["qwer"]
1
> a
{ qwer: 1 }
```

As shown above, `a["xxx"]` and `a.xxx` both give same behavior, which correspond to the same key in the object map. In addition, there are also some edge cases as always, for example:

```javascript
> a = {}
{}
> a[1] = '1'
'1'
> a[{}] = 'obj'
'obj'
> a['1']
'1'
> a[[[1]]]
'1'
> a['0x1']
undefined
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
4
> a["qwer"] = 's'
's'
> a[{}] = 'obj'
'obj'
> a[[[["qwer",]],]]
's'
> a['0']
0
> a[new String('0')]
0
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
> a[0]
'q'
> a['0']
'q'
> a[[[['0']]]]
'q'
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

For `getField`, the current design is to return the same thing as the value corresponding to the key. Therefore, if the element being fetched is tainted, the result is tainted; otherwise, the result is not tainted. The rule is same for the case of type `String`, but the implementation is a bit different. The reason is that for string variable, taint information is stored in another taint, instead of stored together with the character. //todo, maybe add a picture illustration

For `setField`, the current design is to directly assign the value to corresponding key.

However, we may need to strip the key before applying them, because if the key is something like `[[AnnotatedValue(1, true)]]`, when casting to string, it will become `'[object Object]'`, which is not expected `'1'`.

## Native Function Call

### Native Function Recognition

The native functions are JavaScript built-in functions. These do not have to be functions defined in JavaScript standard, but can also be some environment dependent functions, such as DOM APIs. For example, `alert` is a built-in function when JavaScript is running in the browser, and `Number` is a built-in function defined in JavaScript standard that should works fine in all JavaScript implementations.

Therefore, we need to check if a particular function is a native function or user-defined function. After some [investigation](https://davidwalsh.name/detect-native-function), I found that I can convert the function into string by built-in `Function.prototype.toString` function, and then check the result string. If the string is in the form like `"function funcName() { [native code] }"`, it is obvious that the function is a native function. We can check this by regular expression `/function [a-zA-Z_][a-zA-Z0-9_]*\(\)[ \t\n]*\{[ \t\n]*\[native code\][ \t\n]*\}/`. Note that the reason why I choose `Function.prototype.toString` is to prevent the case of code injection. The reason is that the code that `JsTainter` is analyzing might be malicious. It can rewrite the `toString` method of the variable being called as function, so that the identification of native function might not work as expected, and this might also cause security issue. The example of this kind of attack is shown below.

```javascript
var f = {};
f.toString = function () {return "hacked"}
f();
```

### Native Function Call Handler

In `Jalangi2` framework, we can set `invokeFunPre` and `invokeFun` fields of analysis class as handlers, and they will be called before and after any function call is made, respectively. In `invokeFunPre`, nothing is implemented, but set the `skip` field of return value as `true`. By setting this field, `Jalangi2` will not perform the function call anymore. This is the desired behavior because assigning the work to `Jalangi2` will give the wrong result since the arguments are not stripped. Thus, instead, work is done in `invokeFun` handler by `JsTainter`.

In `invokeFun` handler, some checks are done against `f`, the function being called in this function call operation. If it falls into the category of native function, a big `switch` statement will be used to check against the value of `f` , and jump to the corresponding case, in which the taint propagation logic and actual function call are implemented for that particular native function.

### Native Function Rules

In this subsubsectinon I will cover the detail of handler for different native functions.

**String.prototype.substr**

The `substr` function, as its name suggests, takes the sub-string of given string. The first argument is the index and the second argument is length. However, there are some special cases. 

*Firstly*, the input string does not have to be string type: if a variable other than string type is passed as the `this` argument, it will be converted into string first before applying `substr` operation. We can use `getTaintArray` that we implemented before to get the taint array when the variable is converted into `String`, and this problem can be solved.

```javascript
> String.prototype.substr.apply(123456789, [2,3])
'345'
> String.prototype.substr.apply({}, [2,10])
'bject Obje'
> String.prototype.substr.apply([1,2,3,4,5,6,7,8], [2,3])
'2,3'
```

*Secondly*, index can be negative, and when it is negative, it will start from the end. Also, index and length does not have to be `Number`; if they are not `Number`, they will be converted to `Number` first. When they are evaluated to `NaN`, it will be regarded as `0`.

```javascript
> "abcdefghij".substr(-3,2)
'hi'
> "abcdefghij".substr("abcdefghij".length-3,2)
'hi'
> "abcdefghij".substr(-100, 3)
'abc'
> "abcdefghij".substr(NaN, 3)
'abc'
> "abcdefghij".substr({}, 3)
'abc'
> "abcdefghij".substr([[[3]]], [3])
'def'
> "abcdefghij".substr('3', '3')
'def'
```

When `substr` is handled, we must also slice the taint array in the same way as `substr`. For example, for a string `AnnotatedValue("AABB", [true,true,false,false])`, and `substr(1,1)` is applied, the result should be `AnnotatedValue("AB", [true,false])`. However, if we use `Array.prototype.slice` to slice the taint array of string in `substr` operation, we will have too many cases to consider. Thus, I came up with a quick and dirty way to implement it: the taint array can be converted to string first, then apply the `substr` with the same argument, and finally convert it back to taint array. For each character of the transformed string, its ascii value is the index to the taint array, so what `taintArrToStr` actually does is to generate a string with same length and characters with ascending values starting from `'\u0000'`. After `substr` is applied, the ascii values are used as indeces and mapped back to the taint array elements, which are joined togeter to be the result. A piece of code may illustrate my idea better.

```javascript
> var s = taintArrToStr([true, false, true, false])
> s
"\u0000\u0001\u0002\u0003"
> s = s.substr(1,1)
"\u0001\u0002"
> strToTaintArr(s, [true, false, true, false])
[false, true]
```

However, the disadvatange of this approach is that the maximum length of string cannot exceed 65536, the max value of numeric value of character, but fortunately string with such big size rarely occurs.

**Number**

This function convert variable to `Number`, we can just use `rule.compressTaint` to obtain the result taint if the variable will not always evaluated to `NaN`. Stripping and merging are also required before feeding arguments into `Number.apply`. The logic is almost same in arithmetic taint propagation handler.

**String.prototype.charAt**

This function obtains the character at given index, which should return the same taint information as that of charcter at that index. For example, `charAt(1)` of `AnnotatedValue("ABCD", [true,false,true,true])` should be `AnnotatedValue("B", [false])`.

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