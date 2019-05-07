#!/bin/sh
git status
git add -A
git status
git commit -m "$1"
git push
