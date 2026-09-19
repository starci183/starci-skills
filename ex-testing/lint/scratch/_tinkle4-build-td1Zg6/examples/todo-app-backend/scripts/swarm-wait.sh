#!/bin/sh
set -eu
stack=${1:-tiny-stateful};i=0
while [ "$i" -lt 60 ];do
 services=$(docker stack services "$stack" --format '{{.Name}}'|sort|tr '\n' ' ')
 bad=$(docker stack services "$stack" --format '{{.Replicas}}'|awk -F/ '$1!=$2{n++}END{print n+0}')
 if [ "$services" = "${stack}_app ${stack}_gateway " ]&&[ "$bad" -eq 0 ];then
   tasks=$(docker service ps "${stack}_app" "${stack}_gateway" --filter desired-state=running --format '{{.CurrentState}}')
   printf '%s\n' "$tasks"|grep -qv '^Running '||exit 0
 fi
 i=$((i+1));sleep 1
done
echo 'Swarm services did not converge' >&2;exit 1
