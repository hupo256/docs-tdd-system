#!/bin/zsh
# usage: score-prompt.sh <BENCH-ID> <RUN-ID>  → /tmp/p2c-bench/<RUN>.score.prompt
T=$(dirname $0); BENCH=$1; RUN=$2
BASE=$(python3 -c "import json;print(json.load(open('$T/bench.json'))['$BENCH']['base'])")
sed -e "s#{{RUBRIC}}#/Users/aven/github/docs_tdd/plan/replay/$BENCH.md#" -e "s#{{RUN}}#$RUN#g" -e "s#{{BASE}}#$BASE#g" -e "s#{{OUT}}#/tmp/p2c-bench/$RUN.out#" $T/score.tpl > /tmp/p2c-bench/$RUN.score.prompt
echo /tmp/p2c-bench/$RUN.score.prompt
