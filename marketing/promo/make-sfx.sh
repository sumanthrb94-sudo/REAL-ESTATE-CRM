#!/bin/sh
# Sound design for the promo, synthesised with FFmpeg so nothing carries a licence.
# Each family is a different sound; the composition places them on separate lanes.
set -e; mkdir -p assets/sfx; cd assets/sfx; R=48000
ffmpeg -v error -y -f lavfi -i "aevalsrc='random(0)*2-1':s=$R:d=1.6" -af "highpass=f=400,lowpass=f=6000,volume='0.02+0.9*pow(t/1.6,3)':eval=frame,afade=t=out:st=1.45:d=0.15" riser-long.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='random(0)*2-1':s=$R:d=0.8" -af "highpass=f=800,lowpass=f=9000,volume='0.02+0.8*pow(t/0.8,2.5)':eval=frame,afade=t=out:st=0.72:d=0.08" riser-short.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='random(0)*2-1':s=$R:d=0.55" -af "bandpass=f=1200:w=900,volume='0.9*sin(PI*t/0.55)':eval=frame" swoosh-air.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='random(0)*2-1':s=$R:d=0.45" -af "lowpass=f=700,volume='0.9*sin(PI*t/0.45)':eval=frame" swoosh-low.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='random(0)*2-1':s=$R:d=0.05" -af "highpass=f=2500,afade=t=out:st=0.01:d=0.04,volume=0.7" tick.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.9*sin(2*PI*1400*t)*exp(-90*t)+0.5*sin(2*PI*2800*t)*exp(-140*t)':s=$R:d=0.09" click.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.8*sin(2*PI*620*t)*exp(-40*t)':s=$R:d=0.18" blip.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.55*sin(2*PI*880*t)*exp(-3.2*t)+0.3*sin(2*PI*1760*t)*exp(-5*t)+0.15*sin(2*PI*2640*t)*exp(-8*t)':s=$R:d=1.4" chime-high.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.55*sin(2*PI*587*t)*exp(-3*t)+0.3*sin(2*PI*1174*t)*exp(-5*t)+0.12*sin(2*PI*1761*t)*exp(-7*t)':s=$R:d=1.4" chime-mid.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.95*sin(2*PI*(38+70*exp(-9*t))*t)*exp(-2.6*t)':s=$R:d=1.1" drop.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.9*sin(2*PI*(55+120*exp(-30*t))*t)*exp(-9*t)+(random(0)*2-1)*0.3*exp(-40*t)':s=$R:d=0.45" thud.wav
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.5*sin(2*PI*659*t)*exp(-6*t)*lt(t,0.18)+0.5*sin(2*PI*988*(t-0.16))*exp(-4*(t-0.16))*gte(t,0.16)':s=$R:d=1.0" sting.wav
echo "sfx ready"
