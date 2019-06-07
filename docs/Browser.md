# Browser Integration

In last chapter, I have discussed the dynamic taint analysis algorithm part of the project, and made it successfully run in `node.js`. However, the final product should be used to analyze the front-end client website instead of back-end server, so it is required to integrate the product into browser.

## Setups

Initially, the goal is to make a browser extension, but in the [documentation of Jalangi2](https://github.com/Samsung/jalangi2/blob/master/README.md#usage), it is suggested that `Jalangi2` is dependent on `mitmproxy`, which is a `pip` package. It is hard to find a counterpart of `mitmproxy` in browser extension and even if I found one I may need to modify the code of Jalangi2 to make it support proxy other than `mitmproxy`, which is beyond the scope of this project. Thus, to make it simple, besides being a browser extension, the product is also dependent on `mitproxy`.

According to the official example, I figured out the command to run the instrumentation and analysis:

```bash
mitmdump --quiet --anticache -s "jalangi2/scripts/proxy.py --inlineIID --inlineSource --analysis jalangi2/src/js/sample_analyses/ChainedAnalyses.js --analysis Utils.js --analysis Log.js --analysis TaintLogic.js --analysis Browser.js --analysis DynTaintAnalysis.js"
```

The `ChainedAnalyses.js` is a JavaScript file that chain the analysis together and files followed by it are my analysis files.

## Browser.js

Different from `node.js`, there are many DOM APIs when JavaScript is run in browser, including some native functions and some global objects. I will especially take care about `Sources` and `Sinks`. `Sources` are where the user input can be obtained: for example, user input can come from `window.location.hash`, which is part of the URL and can be controlled by user; and user input can also come from native function used to get input such as `prompt`, which pops a window and get the input from user. `Sinks` are some important APIs that analyzer might want to note about when its argument can be controlled by user: for example, web page can modify the HTML content of DOM object by setting field `.innerHTML`; web page can also use `XMLHttpRequest` to send package. If the contents being used for the operations are tainted, analyzer might be interested about that so `JsTainter` may need to record such information.  

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