"""Generate narration audio with AI4Bharat Indic Parler-TTS (Apache-2.0), offline.

One clip per sentence, for every stop and prologue scene, in every language that has
text. Writes public/sites/<site>/vo/<lang>/<key>-<n>.mp3 and vo/manifest.json, which
lists the exact sentences each clip speaks (the app only plays a clip if its text still
matches). Re-running only generates what is missing or changed.

Needs a one-time Hugging Face login (the model is free but gated):  hf auth login
Usage:  tools/.venv-tts/bin/python tools/voice/generate.py [site] [lang ...]
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL = "ai4bharat/indic-parler-tts"

# One calm narrator per language (speaker names recommended on the model card).
VOICES = {
    "en": "Mary speaks in a warm, calm and clear voice at a moderate pace, like a museum guide. The recording is very clear and close, with no background noise.",
    "hi": "Divya speaks in a warm, calm and clear voice at a moderate pace, like a museum guide. The recording is very clear and close, with no background noise.",
    "or": "Debjani speaks in a warm, calm and clear voice at a moderate pace, like a museum guide. The recording is very clear and close, with no background noise.",
}

SPLIT = re.compile(r"(?<=[.!?…।॥])\s+(?=\S)")


def split_sentences(text):
    """Must match splitSentences() in src/engine/narrator.ts."""
    return [s.strip() for s in SPLIT.split(text) if s.strip()]


def loc(v, lang):
    if isinstance(v, str):
        return v if lang == "en" else None
    return v.get(lang)


def stories(site_dir, lang):
    """Yield (key, sentences) for every narrated text in this language."""
    with open(os.path.join(site_dir, "content.json")) as f:
        c = json.load(f)
    ov = {}
    p = os.path.join(site_dir, f"content.{lang}.json")
    if lang != "en" and os.path.exists(p):
        with open(p) as f:
            ov = json.load(f)
    for h in c["hotspots"]:
        o = ov.get("hotspots", {}).get(h["id"], {})
        title = o.get("title") or loc(h["title"], lang)
        body = o.get("body") or loc(h["body"], lang)
        if title and body:
            yield h["id"], [title] + split_sentences(body)
    for i, s in enumerate(c.get("story", [])):
        text = (ov.get("story") or [None] * 99)[i] if lang != "en" else loc(s["text"], "en")
        if text:
            yield f"story-{i}", split_sentences(text)


_m = None


def tts():
    global _m
    if _m is None:
        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        device = "mps" if torch.backends.mps.is_available() else "cpu"
        model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(device)
        tok = AutoTokenizer.from_pretrained(MODEL)
        desc_tok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
        _m = (model, tok, desc_tok, device)
    return _m


def speak(text, lang, out_mp3):
    import soundfile as sf
    import torch

    model, tok, desc_tok, device = tts()
    torch.manual_seed(7)
    d = desc_tok(VOICES[lang], return_tensors="pt").to(device)
    p = tok(text, return_tensors="pt").to(device)
    with torch.no_grad():
        audio = model.generate(input_ids=d.input_ids, attention_mask=d.attention_mask, prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
    wav = audio.cpu().numpy().squeeze()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, wav, model.config.sampling_rate)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-b:a", "64k", out_mp3], check=True)
        os.unlink(tmp.name)


def main(site, langs):
    site_dir = os.path.join(ROOT, "src", "sites", site)
    vo = os.path.join(ROOT, "public", "sites", site, "vo")
    man_path = os.path.join(vo, "manifest.json")
    manifest = {}
    if os.path.exists(man_path):
        with open(man_path) as f:
            manifest = json.load(f)
    for lang in langs:
        os.makedirs(os.path.join(vo, lang), exist_ok=True)
        done = manifest.setdefault(lang, {})
        for key, sentences in stories(site_dir, lang):
            if done.get(key) == sentences and all(os.path.exists(os.path.join(vo, lang, f"{key}-{i}.mp3")) for i in range(len(sentences))):
                continue
            t0 = time.time()
            old = done.get(key) or []
            for i, s in enumerate(sentences):
                path = os.path.join(vo, lang, f"{key}-{i}.mp3")
                if i < len(old) and old[i] == s and os.path.exists(path):
                    continue
                speak(s, lang, path)
            done[key] = sentences
            with open(man_path, "w") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=1)
            print(f"{lang} {key}: {len(sentences)} clips in {time.time() - t0:.0f}s", flush=True)
    print("manifest:", man_path)


if __name__ == "__main__":
    args = sys.argv[1:]
    site = args[0] if args else "konark"
    langs = args[1:] or ["en", "hi", "or"]
    main(site, langs)
