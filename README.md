# JsTainter

A framework that performs dynamic taint analysis on JavaScript program.

## Install

```bash
git clone https://github.com/Mem2019/JsTainter.git # clone JsTainter
cd JsTainter/
git clone https://github.com/Mem2019/jalangi2.git # clone modified jalangi2 framework
cd jalangi2/
npm install # install jalangi2, but dependency should be installed first
```

You may also need to refer to instructions in [https://github.com/Mem2019/jalangi2](https://github.com/Mem2019/jalangi2) to setup dependencies, including `mitmproxy` and its credential setup. 

## Usage

### Perform Analysis

```bash
./run.sh # at JsTainter/ directory
```

Then change the proxy of the browser to `127.0.0.1:8080`, enter the URL of the website you want to analyze. When you think the analysis is finished, press the `Jalangi` button at the left upper corner, and if you open the console in browser development tools, you can see a JSON is printed, which is the result of the taint analysis.

### Visualization

To visualize the taint flow, open `visualizer/index.html` in browser. The cached JavaScript file of the website is in `cache/[domain of the website]/[some hash]/[some hash].js`, use `load` button to load one or more files. Then copy the JSON obtained into the text area, press `play` to visualize taint flow. 

