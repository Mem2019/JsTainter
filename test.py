from os import system,walk
from re import search
cmd = "node jalangi2/src/js/commands/jalangi.js --inlineIID --inlineSource --analysis jalangi2/src/js/sample_analyses/ChainedAnalyses.js --analysis jalangi2/src/js/runtime/SMemory.js --analysis jalangi2/src/js/sample_analyses/dlint/Utils.js --analysis DynTaintAnalysis.js tests/%s"

i = 0
for root,subdirs,files in walk("./tests/"):
	i += 1
assert i == 1

# print root, subdirs, files
for f in files:
	ret = search("^test[a-zA-Z0-9]+\\.js$", f)
	if ret:
		print "Testing file: " + f
		ret = system(cmd % f)
		if ret != 0:
			print "Error in file %s" % f
			exit(-1)