# Narrate a reel spec with Kokoro-82M (Apache 2.0, fully local, no API key).
#
# Same engine as voice.py, but driven by reels/<id>.json rather than one fixed
# cue list, so a new reel needs a spec and nothing else. Each line is trimmed of
# leading and trailing silence and its real duration written back, because scene
# length follows the read: a longer sentence makes a longer scene rather than
# being crammed into a slot someone guessed at.
#
#   python3 vo/narrate.py <kokoro model dir> [voice] [reel-id ...]

import json, subprocess, sys, os, glob

here = os.path.dirname(os.path.abspath(__file__))
promo = os.path.dirname(here)
models = sys.argv[1]
voice = sys.argv[2] if len(sys.argv) > 2 else "am_michael"
only = set(sys.argv[3:])

from kokoro_onnx import Kokoro
k = Kokoro(f"{models}/kokoro-v1.0.onnx", f"{models}/voices-v1.0.bin")

def say(text, path):
    samples, sr = k.create(text, voice=voice, speed=0.98,
                           lang="en-gb" if voice.startswith("b") else "en-us")
    import soundfile as sf
    sf.write(path, samples, sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                    "apad=pad_dur=0.15", "-ar", "48000", path + ".t.wav"], check=True)
    os.replace(path + ".t.wav", path)
    return round(float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path]).decode().strip()), 3)

for spec_path in sorted(glob.glob(f"{promo}/reels/*.json")):
    if spec_path.endswith(".timings.json"):
        continue
    spec = json.load(open(spec_path))
    if only and spec["id"] not in only:
        continue
    out_dir = f"{promo}/assets/vo/{spec['id']}"
    os.makedirs(out_dir, exist_ok=True)

    # The hook's spoken line is its question; the three slam lines are read on
    # screen, not aloud, so the cut lands on the beat rather than narrating type.
    lines = [("hook", spec["hook"]["question"])]
    lines += [(s["id"], s["vo"]) for s in spec["scenes"]]
    lines += [("cta", f"{spec['cta']['tag']} {spec['cta']['button']}.")]

    cues = []
    for cue_id, text in lines:
        dur = say(text, f"{out_dir}/{cue_id}.wav")
        cues.append({"id": cue_id, "text": text, "file": f"{cue_id}.wav", "duration": dur})
        print(f"  {spec['id']:18s} {cue_id:16s} {dur:5.2f}s")
    total = round(sum(c["duration"] for c in cues), 2)
    json.dump({"voice": voice, "cues": cues},
              open(f"{promo}/reels/{spec['id']}.timings.json", "w"), indent=1)
    print(f"  {spec['id']:18s} {'TOTAL':16s} {total:5.2f}s of speech\n")
