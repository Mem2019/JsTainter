#!/bin/sh
rm -rf cache/
mitmdump --quiet --anticache -s "jalangi2/scripts/proxy.py --inlineIID --inlineSource --analysis jalangi2/src/js/sample_analyses/ChainedAnalyses.js --analysis Utils.js --analysis Log.js --analysis MultSrcTaintLogic.js --analysis Browser.js --analysis DefaultConfig.js --analysis DynTaintAnalysis.js"
