#!/bin/sh
node jalangi2/src/js/commands/jalangi.js --inlineIID --inlineSource --analysis jalangi2/src/js/sample_analyses/ChainedAnalyses.js --analysis jalangi2/src/js/runtime/SMemory.js --analysis jalangi2/src/js/sample_analyses/dlint/Utils.js --analysis DynTaintAnalysis.js test.js
