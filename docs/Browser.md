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

## Multiple Sources

# Source and Sink

In this section, I will discuss different types of possible source and sink in browser, and my approach to handle them.

## Source

### window.location

As I suggests in last section, this stands for URL of web page. However, there are several different fields in this object.

**`hash` and `search`**

Field `search` is the query string begin with `?`, and field `hash` is the fragment string begin with `#`. These two are all parts of the URL and can by controlled by user, thus should be tainted. What I mean by "tainted" here is "fully tainted". Since shadow value of string is an array of `taint information variable` as I suggested in last chapter is However, there are some special cases. 

Field `pathname` is the path of the URL, which can be both tainted and untainted: when static path is used, the `pathname` should be untainted because content of page will change if path is modified; when path is used in the same way as query string, `pathname` should be tainted because user can control this string without going to another page. Therefore, since this is dependent on different website implementation, I should enable user to manually set this: there is a field in `config` variable that is used to specify if `pathname` should be tainted. 

Field `href` is the whole URL, which obviously cannot be fully 

# Browser Extension Todos

1. try to run it successfully in browser, 

   ​	handle the browser case taint (source and sink), add multiple sources taint analysis

   ​	visualize the taint propagation using `codemirror`, make it a usable product in current extent

   ​	handle the case of read of reference where internal stuff is tainted, maybe use user config again

   ​	source and sink both include native function call and set/put field

2. find the case where it is commonly used but not properly handled and modify, including Jalangi2 and JsTainter

   ​	e.g. `const` and `lambda` bug in Jalangi2, some more native functions that are common

3. so run it successfully with better accuracy, finish report & evaluation

4. extension: visualization, taint level, symbolic execution, `instrumentCodePre` to anti-anti-instrumentation, etc...