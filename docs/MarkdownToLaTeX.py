from sys import argv
import re
assert len(argv) == 2

f = open(argv[1], 'rb')
md = f.read()
f.close()

def replace_regex(data, r, left, right):
	while True:
		x = re.search(r, data)
		if x is None:
			break
		#print x.start(),x.end(),x.groups()
		seg = x.groups()[0]
		pre = data[:x.start()]
		post = data[x.end():]
		data = pre + left + seg + right + post
		#print data
	return data

def replace(data, r, res):
	while True:
		x = re.search(r, data)
		if x is None:
			break
		pre = data[:x.start()]
		post = data[x.end():]
		data = pre + res + post
	return data

res = replace_regex(md, "\n# (.*)\n", "\n\\section{", "}\n")
res = replace_regex(res, "\n## (.*)\n", "\n\\subsection{", "}\n")
res = replace_regex(res, "\n### (.*)\n", "\n\\subsubsection{", "}\n")
res = replace_regex(res, "`([^`\n]+)`", "\\texttt{", "}")
res = replace_regex(res, "\\*\\*([^\\*\n]+)\\*\\*", "\\textbf{", "}")
res = replace_regex(res, "\\*([^\\*\n]+)\\*", "\\textit{", "}")
res = replace(res, "```javascript", "\\begin{minted}{javascript}")
res = replace(res, "```", "\\end{minted}")
#res = replace(res, "\\$", "\\$")
print res