#!/bin/sh
# Music bed of exactly the composition's length: D minor add9 pad, soft pulse at 96 bpm.
# usage: sh make-bed.sh <seconds>
set -e; T=$1; FO=$(python3 -c "print(round($T-2.6,2))"); R=48000
ffmpeg -v error -y -f lavfi -i "aevalsrc='(0.16*sin(2*PI*146.83*t)+0.13*sin(2*PI*220*t)+0.10*sin(2*PI*293.66*t)+0.09*sin(2*PI*329.63*t)+0.07*sin(2*PI*440*t)+0.05*sin(2*PI*146.83*1.003*t))*(0.8+0.2*sin(2*PI*0.11*t))+0.35*sin(2*PI*52*t)*exp(-12*mod(t,0.625))':s=$R:d=$T" -af "lowpass=f=900,aecho=0.7:0.5:180|360:0.25|0.15,afade=t=in:d=1.2,afade=t=out:st=$FO:d=2.5,volume=0.85" assets/bed.wav
