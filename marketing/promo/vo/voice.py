# Narration for the promo: Kokoro-82M (Apache 2.0), fully local.
import json, subprocess, sys, os
from kokoro_onnx import Kokoro
import soundfile as sf
here = os.path.dirname(os.path.abspath(__file__))
models = sys.argv[1]; voice = sys.argv[2] if len(sys.argv) > 2 else "am_michael"
k = Kokoro(f"{models}/kokoro-v1.0.onnx", f"{models}/voices-v1.0.bin")
out = []
for c in json.load(open(f"{here}/cues.json")):
    samples, sr = k.create(c["text"], voice=voice, speed=0.98, lang="en-gb" if voice.startswith("b") else "en-us")
    path = f"{here}/{c['id']}.wav"; sf.write(path, samples, sr)
    # trim leading/trailing silence so cue timing is tight
    subprocess.run(["ffmpeg","-v","error","-y","-i",path,"-af","silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.15","-ar","48000",path+".t.wav"],check=True)
    os.replace(path+".t.wav", path)
    dur = float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",path]).decode().strip())
    out.append({**c, "file": f"{c['id']}.wav", "duration": round(dur, 3)})
    print(c["id"], round(dur,2), "s")
json.dump({"voice": voice, "cues": out}, open(f"{here}/timings.json","w"), indent=2)
