# Overview

## Choice

In the background chapter, I have covered 3 approach: dynamic taint analysis, static taint analysis and blended taint analysis. The blended taint analysis is simply improved version of static analysis, so the key point is to compare blended taint analysis with dynamic taint analysis. 

Although blended analysis gather the dynamic information firstly, it still applies static analysis to get the final result. By contrast, dynamic analysis traces the program and perform analysis as it runs, which should give higher accuracy. The reason is that the dynamic information that can be gathered by blended analysis in first stage is not informative enough: since the analysis and dynamic tracing is done separately, the dynamic information that can be used by static analysis is limited. By contrast, dynamic analysis can provides almost all dynamic information because the analysis is done along with the dynamic tracing.

For example, when array and object are used to store tainted user input, the blended taint analysis might not function well.

```javascript
const hash = window.location.hash; // hash is tainted
const obj = {hash: hash};
function get(obj, prop)
{
	return obj[prop];
}
const r = get(obj, "hash"); // equivalent to obj.hash
```

If blended analysis is used here, it is hard to identify `r` is actually fetched from `obj.hash` unless using complicated program analysis techniques; however, using dynamic taint analysis, since analysis is performed along with program tracing, it is easy to figure out `obj.hash` is returned and assigned to `r`, which should be tainted. 

However, there is an advantage of blended analysis: the implicit flow can be detected. Since dynamic analysis can only perform analysis for every JavaScript operation separately, it is hard to view and analyze the JavaScript codes as a whole to figure out implicit flow. By contrast, in static phase of blended analysis, if good program analysis technique is applied, it is possible to detect implicit flow. Nonetheless, as the program logic becomes complicated, program analysis can also get wrong. Therefore, considering the difficulty of performing program analysis on JavaScript and the uncertain effectiveness of automatic implicit flow detection, I would still favor dynamic analysis rather than blended analysis.

## Overall Structure

Here is the UML graph of my project. //todo

As I have suggested in background chapter, everything is based on Jalangi2 framework, thus every class is a field of `J$`. 

Field `analysis` is an instance of class that implements the main dynamic taint analysis logic, which is implemented in file `DynTaintAnalysis.js`. In this class, callback functions specified by Jalangi2 that will be called in runtime dynamic analysis are defined and implemented. The `results` field is used to store the result of taint analysis, which will be covered later.

Field `dtaTaintLogic` is the actual implementation of taint propagation rule for the particular type of `taint information variable`, which will be covered later. In other word, the `template method design pattern` is used here: if I want to change the type of `taint information variable`, ideally I only I need to change the instance stored in `dtaTaintLogic` field, without modifying codes in other files, which is a good software engineering practice.

Field `dtaBrowser` is some browser-side handling codes. This is separated from `DynTaintAnalysis.js` because I want the code to be both runnable in `node.js` and in browser. This is also a `template method design pattern`, and I will cover the detail about this when browser integration is discussed. 

Field `dtaUtils` is a utility class in which some utility functions are implemented. These functions could not only be used by `DynTaintAnalysis.js`, but can also be used by other files, because this is simply a low-level utility class.

Field `dtaConfig` is a configuration instance used to specify the some behaviors of taint analysis algorithm. This will be covered in detail later.

# Design of Shadow Value

## Taint Information Variable

`Taint Information Variable` is used to record the taint state of basic variable types such as number and single character. I will discuss how taint information variable, which are used to describe basic type only, can be used to describe taint state of complex types such as `Object` in next subsection. In this subsection, I will discuss several design choices about taint information variable. 

### Boolean Variable

This is the simplest design: the shadow value is simply `true` or `false`. `true` if the variable is tainted, and `false` if the variable is not tainted. This is the easiest design choice to implement. In the following report, if I am going to make an example of `AnnotatedValue`, I will use this design choice in the example because this is simple and makes the example easy to understand.

### Boolean Array for Sources

User inputs of web page in browser can come from different sources. For example, user input can come from argument in URL and `<input>` HTML label. Because of that, it is necessary to be able to identify the source of the taint given a tainted variable. 

To implement this, we can use a boolean array, in which different indeces denotes taint state from different source. For example, element at index 0 can be taint state from source URL argument, while element at index 1 can be the taint state from `<input>` HTML label. If one array element at particular index is `true`, it means current basic variable is tainted by the source corresponding to that index. 

There is also an possible optimization: instead of using boolean array, we can use an integer instead, where each bit correspond to an original boolean variable in array. Such optimization saves space and time, but exerts limitation on number of sources: maximum number of source is 32 if the integer is only 32-bit wide, for example.

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

This is an "soft" version of boolean variable. Unlike boolean variable which can only be `true` or `false`, tainted level is a floating point number that range from 0 to 1. Value 1 means the variable along with this shadow value is fully tainted. In other word, the variable can be fully controlled by user. Value 0 means the variable is not tainted and cannot be controlled by user. The value in between means the variable can be controlled by user, but cannot be fully controlled by user. 

For example, there is a number with taint level 1, say `AnnotatedValue(1337, 1.0)`, and is converted to string, so the result is `"1337"`. However, what taint information variable should I assign to each character? If a boolean strategy is used, they are all `true`, which makes sense but is not completely accurate, because user can only control the string within the range `'0'-'9'`, and this is different from a string that can be fully controlled. This is where `taint level` comes, the taint level for this string should be somewhere between 0 and 1.

Nonetheless, specific rule for this strategy need more investigation: for example, what specific formula should be applied to calculate taint level as the tainted variable propagates? The details can give rise to many problems, so this strategy should be regard as extension.

### Symbolic Expression

This is actually not about taint analysis but about symbolic execution. Instead of just recording a state of taint, whole expression is traced. I have covered some of this when [this paper](todo) is discussed in background section. 

However, different from normal symbolic execution which will result in multiple states when a symbolic expression is used in conditional jumps, my current code does not support such multiple states, because different implementation of taint variable is simply different implementation of `dtaTaintLogic` field in `J$`. The main taint analysis logic in `DynTaintAnalysis.js` (will be discussed later) does not vary as the implementation of taint information variable changes, and this file is not designed to have multiple states. 

Therefore, current strategy could only be to log the expression on both sides when a symbolic expression is used in conditional jumps.

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

There is also another point to note: as long as an object is created, it must be wrapped by `AnnotatedValue`. For example, when an object literal is assigned to a variable (e.g. `var o = {}`), in the `analysis.literal` callback, we must change `{}` to `AnnotatedValue({}, {})`. The reason is when `putField` is applied to any object, base variable cannot be modified in the `analysis.putField` callback function. Even if the assigned value is tainted, we are not able to change the base to `AnnotatedValue` anymore. Therefore to prevent such cases, objects created by JavaScript program should all be wrapped by `AnnotatedValue`.  

### Basic types

For any other basic types, such as `Number` and `Boolean`, have shadow value with only one `taint information variable`. This also includes the case like `undefined` and `NaN`.

### Function

Function variable is never tainted, since it is very rare for function to be controllable by user.
