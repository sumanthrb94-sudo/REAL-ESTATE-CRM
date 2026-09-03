#!/bin/sh
# One music bed per reel, in the reel's own key.
#
# Five ads running in one campaign should not share one loop: the ear notices a
# repeated bed faster than the eye notices a repeated layout. Same instrument
# and same 96 bpm pulse so the set stays recognisable, different root so each
# reel has its own colour. Root frequencies are the palette's key, roughly:
# cobalt D, ink A, ember F, teal G, violet C.
#
#   sh make-beds.sh <reel-id> <root hz> <seconds>
set -e
REEL=$1; F=$2; T=$3; R=48000
FO=$(python3 -c "print(round($T-2.6,2))")
ffmpeg -v error -y -f lavfi -i "aevalsrc='(\
0.16*sin(2*PI*$F*t)\
+0.13*sin(2*PI*$F*1.5*t)\
+0.10*sin(2*PI*$F*2*t)\
+0.09*sin(2*PI*$F*2.25*t)\
+0.07*sin(2*PI*$F*3*t)\
+0.05*sin(2*PI*$F*1.003*t))*(0.8+0.2*sin(2*PI*0.11*t))\
+0.35*sin(2*PI*($F/2.8)*t)*exp(-12*mod(t,0.625))':s=$R:d=$T" \
  -af "lowpass=f=900,aecho=0.7:0.5:180|360:0.25|0.15,afade=t=in:d=1.2,afade=t=out:st=$FO:d=2.5,volume=0.85" \
  "assets/bed-$REEL.wav"
