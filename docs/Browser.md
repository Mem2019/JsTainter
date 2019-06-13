# Browser Integration Overview

In last chapter, I have discussed the dynamic taint analysis algorithm part of the project, and made it successfully run in `node.js`. However, the final product should be used to analyze the front-end client website instead of back-end server, so it is required to integrate the product into browser.

## Setups

Initially, the goal is to make a browser extension, but in the [documentation of Jalangi2](https://github.com/Samsung/jalangi2/blob/master/README.md#usage), it is suggested that `Jalangi2` is dependent on `mitmproxy`, which is a `pip` package. It is hard to find a counterpart of `mitmproxy` in browser extension and even if I found one I may need to modify the code of Jalangi2 to make it support proxy other than `mitmproxy`, which is beyond the scope of this project. Thus, to make it simple, besides being a browser extension, the product is also dependent on `mitproxy`.

According to the official example, I figured out the command to run the instrumentation and analysis:

```bash
mitmdump --quiet --anticache -s "jalangi2/scripts/proxy.py --inlineIID --inlineSource --analysis jalangi2/src/js/sample_analyses/ChainedAnalyses.js --analysis Utils.js --analysis Log.js --analysis TaintLogic.js --analysis Browser.js --analysis DynTaintAnalysis.js"
```

The `ChainedAnalyses.js` is a JavaScript file that chain the analysis together and files followed by it are my analysis files.

## Browser.js

Different from `node.js`, there are many DOM APIs when JavaScript is run in browser, including some native functions and some global objects. I will especially take care about `Sources` and `Sinks`. `Sources` are where the user input can be obtained: for example, user input can come from `window.location.hash`, which is part of the URL and can be controlled by user; and user input can also come from native function used to get input such as `prompt`, which pops a window and get the input from user. `Sinks` are some important APIs that analyzer might want to note about when its argument can be controlled by user: for example, web page can modify the HTML content of DOM object by setting field `.innerHTML`; web page can also use `XMLHttpRequest` to send package. If the contents being used for the operations are tainted, analyzer might be interested about such information, so `JsTainter` may need to record when a tainted variable is passed into them.

Therefore, the reason why this file exists is to write some browser specific code that processes the `Source` and `Sink` and to separate it from the dynamic taint analysis algorithm codes. The advantage for this is that I want my code to be still runnable on `node.js` for more convenient testing, and if we just simply put everything together (e.i. put the browser logic into `DynTaintAnalysis.js`), it will not only be bad software engineering design, but might also cause `ReferenceError` exception since global DOM object variable is not defined in `node.js`. 

Nonetheless, in `DynTaintAnalysis.js`, the `dtaBrowser` field of `J$`, which is used to export `Browser` object, will still be accessed, so my way to solve this problem is to have a `NullBrowser` object for `node.js` that basically perform nothing except the methods are defined so no `Error` will be thrown. To be specific, in the command line of running this in `node.js`, `--analysis Browser.js` is changed to `--analysis NullBrowser.js`. This piece of code may illustrate the idea better.

```javascript
//Browser.js
(function (sandbox) {
function Browser(){}
Browser.prototype.getField = function (base, offset)
{
	//process DOM global object get field operation...
	//e.g. window.location.hash
};
Browser.prototype.invokeFun = function (f, abase, args)
{
	//process DOM native function call...
	//e.g. prompt
};
//process other DOM-related operations...
sandbox.dtaBrowser = new Browser();
})(J$);

//NullBrowser.js
(function (sandbox) {
function Browser(){}
Browser.prototype.getField = function () {};
Browser.prototype.invokeFun = function () {};
//other DOM-related operations are also dummy functions...
sandbox.dtaBrowser = new Browser();
})(J$);
```

When the relative taint analysis is performed, the method in `Browser` will be called first, and if it returns `undefined`, normal handling will be performed; if not, which means the operation is DOM-related and has already been handled, so analysis function will return directly. For example, here is how `dtaBrowser.getField` is called in `analysis.getField`.

```javascript
ret = sandbox.dtaBrowser.getField(abase, aoff);
if (typeof ret != 'undefined')
{
	//`ret` is the result, if is not `undefined`
	return new AnnotatedValue(ret.ret, ret.sv);
}
else
{
	// normal getField handling
}
```

The reason why `dtaBrowser.getField` does not return a `AnnotatedValue` object is that I do not want `Browser.js` to be dependent on `AnnotatedValue` class, which is implemented in `DynTaintAnalysis.js`.

For sinks, everything is same except that only record will be added to `results`, but the function will not be returned.

```javascript
if (isTainted(sval))
{
	const ret = sandbox.dtaBrowser.putField(
		abase, aoff, aval, sval, config);
	if (typeof ret !== 'undefined')
	{
		addLogRec(this, getPosition(iid), ret.msg);
	}
}
```



## Multiple Sources Implementation

As I have mentioned in last chapter, we can use an array of boolean variable to represent multiple source, which can be further optimized to a number. In browser, this becomes more important, since user inputs can come from different sources. `MultSrcTaintLogic.js` is the file that implements multiple source taint propagation. The logic is almost same except `||` is changed to `|`, because now number is used to represent a boolean array, and bitwise `or` is same as applying `or` to every corresponding element of the boolean array. Another difference is `taintSource` function used to obtain the initial `taint information variable` for source, instead of just returning true, `id` argument is used as the shift amount. The code is shown below.

```javascript
TaintUnit.prototype.taintSource = function (id)
{
	return 1 << id;
};
```

 When this function is called, `id` must be different for different sources. For example, in my implementation, `id` is 1 for URL string.

### ID Allocator

However, even if the type of input is same, the taint `id` should still be different sometimes. For example, when `prompt` function is called multiple times, the `id` should be different for each time in order to specify which `prompt` a particular taint comes from. Therefore, an `id` allocator is required. 

My approach to implement allocator is very easy, the code is shown below.

```javascript
//Implemented in class Browser
var nextId = 1;
this.getNextId = function ()
{
	if (nextId >= 32)
		throw Error("Too many input sources");
	return nextId++; // return nextId, and increment it
};
```

Since JavaScript shift operator only support 32 bit integer (e.i. because `1 << 32 === 1`), the maximum size of this boolean array represented in integer form is 32, and an `Error` is thrown if there are too many `id`s being allocated. 

# Source and Sink

In this section, I will discuss different types of possible source and sink in browser, and my approach to handle them.

## Source

### window.location

As I suggests in last section, this stands for URL of web page. However, there are several different fields in this object.

Field `search` is the query string begin with `?`, and field `hash` is the fragment string begin with `#`. These two are all parts of the URL and can by controlled by user, thus all of characters in string should be tainted, which means all elements in shadow value array should set to return value from `taintSource`. However, there are some special cases. 

Field `pathname` is the path of the URL, which can be both tainted and untainted: when static path is used, the `pathname` should be untainted because content of page will change if path is modified; when path is used in the same way as query string, `pathname` should be tainted because user can control this string without going to another page. Therefore, since this is dependent on different website implementation, I should enable user to manually set this: there is a field in `config` variable that is used to specify if `pathname` should be tainted. 

Field `href` is the whole URL, which obviously cannot be fully controlled by user: user can control query string and fragment only, and can control path if corresponding `config` field is set as I mentioned before. Therefore, only part of the string is tainted (set to return value from `taintSource`) and remaining string is untainted (set to value 0). My approach to identify the boundary is to use `indexOf` function as shown.

```javascript
const start = config.taintPathName ?
	base.href.indexOf(base.origin) + base.origin.length :
	base.href.indexOf('?');
```

If `taintPathName` is set to `true`, the tainted part starts after `base.origin`, which is start of the path; if not, the tainted part starts after the first `?`, which is start of the query string.

### prompt

Since the string returned from `prompt` function can be fully controlled by user, all characters in string should be tainted. However, when user click "cancel", `null` will be returned and it will not be marked as tainted, since in current rule `null` cannot be tainted. 

### HTMLInputElement

`HTMLInputElement` is the HTML input tag, for example `<input type="text" id="myText">`. JavaScript program can access the content in this input tag by using `document.getElementById("myText").value`, which should all be tainted as it can be fully controlled by user. 

**Store Previously Allocated ID**

For different input tags, different `id` values are used. However, for same input tag, the `id` should be same. Therefore, we need a recording that maps the input tag DOM object to previously allocated `id` value, if any. Since JavaScript object only supports string as property, we cannot use object to implement the map. Therefore, an array is used to represent such information. I have implemented a `getInputId` function: given a input tag DOM object, return the corresponding `id`, which can be previously recorded or newly allocated, depending on if this object is found in that recording array. 

```javascript
var inputsArr = [];
this.getInputId = function (input)
{// `input` is DOM object of input tag, e.g. document.getElementById("myText")
	for (var i = 0; i < inputsArr; i++)
	{
		if (inputsArr[i].input === input)
			return inputsArr[i].id; // return the id, if found 
	}
	const nextId = this.getNextId();
	inputsArr.push({input:input, id:nextId});
	return nextId; // allocate and record new id, if not found
};
```

However, there are drawbacks for this approach: the complexity is `O(n)`. Another approach could be replacing `inputsArr` with an object, which uses `id` field of DOM object as the property that maps to previously allocated `id` value (e.g. `{myText: 1}`). However, even `id` for each DOM object should be unique according to the specification, a HTML page does not have to conform the standard, which might cause problem. By contrast, the `O(n)` complexity does not hurt so much because there would not be as many input tags in a HTML page. 

## Sink

There are two types of sinks. The first one is when field of global object is set, and the second one is native function that deserve notice. Although there are still many types of sinks, 

### Global Object Field Set

This include changing `window.location.href` and `document.cookie`. When they are modified to something tainted, message is recorded.

### Native Function Sink

This includes functions like `document.write`.

# Browser Extension Todos

1. try to run it successfully in browser, 

   ​	handle the browser case taint (source and sink), add multiple sources taint analysis

   ​	visualize the taint propagation using `codemirror`, make it a usable product in current extent

   ​	handle the case of read of reference where internal stuff is tainted, maybe use user config again

   ​	source and sink both include native function call and set/put field

2. find the case where it is commonly used but not properly handled and modify, including Jalangi2 and JsTainter

   ​	e.g. `const` and `lambda` bug in Jalangi2, some more native functions that are common

   ​	base64 JSON

3. so run it successfully with better accuracy, finish report & evaluation

4. extension: visualization, taint level, symbolic execution, `instrumentCodePre` to anti-anti-instrumentation, etc...