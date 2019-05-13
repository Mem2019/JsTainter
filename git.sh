#!/bin/sh
if [ -z "$1" ]
then
echo "please input commit message"
else 
git status
git add -A
git status
git commit -m "$1"
git push
fi
