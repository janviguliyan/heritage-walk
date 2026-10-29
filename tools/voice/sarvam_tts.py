"""Narration in Indian voices with Sarvam AI's Bulbul, for English, Hindi and Odia (one voice family).

Same output as generate.py: one clip per sentence at public/sites/<site>/vo/<lang>/<key>-<n>.mp3,
listed with its exact text in vo/manifest.json (the app plays a clip only if its text still
matches). Re-running only generates what is missing or changed. Standard library only.

API key: SARVAM_API_KEY=... in .env.local (git-ignored).

  python3 tools/voice/sarvam_tts.py --samples                       # compare speakers -> tools/voice/samples/
  python3 tools/voice/sarvam_tts.py --lang en --speaker <name>      # all English narration
  python3 tools/voice/sarvam_tts.py --lang hi or --speaker <name>   # Hindi and Odia
  python3 tools/voice/sarvam_tts.py --lang en --speaker <name> --only arrival reel-0
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import sarvam  # noqa: E402
from generate import ROOT, split_sentences, stories  # noqa: E402

MODEL = "bulbul:v3"
SAMPLE_SPEAKERS = ["aditya", "rahul", "kabir", "anand", "priya", "ritu", "shreya", "kavya"]
SAMPLE_TEXT = {
    "en": "You are standing at the east end, where the temple begins. Konark joins kona, corner, and arka, the sun.",
    "hi": "आप पूर्वी छोर पर खड़े हैं, जहाँ से मंदिर शुरू होता है। कोणार्क, कोण और अर्क से मिलकर बना है।",
    "or": "ଆପଣ ପୂର୍ବ ପ୍ରାନ୍ତରେ ଠିଆ ହୋଇଛନ୍ତି, ଯେଉଁଠାରୁ ମନ୍ଦିର ଆରମ୍ଭ ହୁଏ। କୋଣାର୍କ, କୋଣ ଓ ଅର୍କରୁ ଗଠିତ।",
}


def reel_lines(lang):
    """The story reel's lines (keys reel-0..), from the UI strings of that language."""
    with open(os.path.join(ROOT, "src", "i18n", f"ui.{lang}.json")) as f:
        ui = json.load(f)
    i = 0
    while f"reel.{i + 1}" in ui:
        yield f"reel-{i}", split_sentences(ui[f"reel.{i + 1}"])
        i += 1


def samples(langs):
    out = os.path.join(HERE, "samples")
    os.makedirs(out, exist_ok=True)
    for sp in SAMPLE_SPEAKERS:
        for lang in langs:
            p = os.path.join(out, f"{lang}-{sp}.mp3")
            with open(p, "wb") as f:
                f.write(sarvam.speak(SAMPLE_TEXT[lang], lang, sp, MODEL))
            print("wrote", p, flush=True)


def generate(lang, speaker, site, only):
    vo = os.path.join(ROOT, "public", "sites", site, "vo")
    man_path = os.path.join(vo, "manifest.json")
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    os.makedirs(os.path.join(vo, lang), exist_ok=True)
    done = manifest.setdefault(lang, {})
    voices = manifest.setdefault("_voices", {})
    tag = f"sarvam:{MODEL}:{speaker}"
    chars = 0
    for key, sentences in [*stories(os.path.join(ROOT, "src", "sites", site), lang), *reel_lines(lang)]:
        if only and key not in only:
            continue
        same = voices.get(f"{lang}/{key}") == tag
        old = done.get(key) or []
        for i, s in enumerate(sentences):
            path = os.path.join(vo, lang, f"{key}-{i}.mp3")
            if same and i < len(old) and old[i] == s and os.path.exists(path):
                continue
            with open(path, "wb") as f:
                f.write(sarvam.speak(s, lang, speaker, MODEL))
            chars += len(s)
        done[key] = sentences
        voices[f"{lang}/{key}"] = tag
        with open(man_path, "w") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)
        print(f"{lang} {key}: {len(sentences)} clips", flush=True)
    print(f"{lang}: done; {chars} characters sent to Sarvam")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", action="store_true")
    ap.add_argument("--lang", nargs="*", default=["en"])
    ap.add_argument("--speaker")
    ap.add_argument("--site", default="konark")
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    if a.samples:
        return samples(a.lang if a.lang != ["en"] else ["en", "hi", "or"])
    if not a.speaker:
        sys.exit("Choose a speaker with --speaker (listen to --samples first).")
    for lang in a.lang:
        generate(lang, a.speaker, a.site, a.only)


if __name__ == "__main__":
    main()
