"""Translate the tour's UI and site content with Sarvam-Translate (open weights, run locally).

Model: sarvamai/sarvam-translate (GPL-3.0) — supports 22 Indian languages. Runs offline
on this machine; nothing is sent to a service. Results are cached, so re-running only
translates new or changed English text. Every translation should still be checked by a
native speaker before launch.

With SARVAM_API_KEY in .env.local, the same model is called through Sarvam's API instead
(no local model needed; set SARVAM_LOCAL=1 to force the local one).

Usage:
  python3 tools/i18n/translate.py hi or                                  # via the API
  tools/.venv-translate/bin/python tools/i18n/translate.py hi or        # all targets
  tools/.venv-translate/bin/python tools/i18n/translate.py --test "Let's go" hi
"""
import json
import os
import re
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(os.path.dirname(__file__), "cache.json")
# human corrections: {"<lang>": {"<English>": "<corrected translation>"}} — always win over the model
OVERRIDES = os.path.join(os.path.dirname(__file__), "overrides.json")
NAMES = {
    "hi": "Hindi", "or": "Odia", "bn": "Bengali", "as": "Assamese", "gu": "Gujarati", "kn": "Kannada",
    "ml": "Malayalam", "mr": "Marathi", "pa": "Punjabi", "ta": "Tamil", "te": "Telugu", "ur": "Urdu",
    "ne": "Nepali", "sa": "Sanskrit", "kok": "Konkani", "mai": "Maithili", "doi": "Dogri", "brx": "Bodo",
    "ks": "Kashmiri", "mni": "Manipuri", "sat": "Santali", "sd": "Sindhi",
}

_model = None
_tok = None


def load():
    global _model, _tok
    if _model is None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        name = "sarvamai/sarvam-translate"
        _tok = AutoTokenizer.from_pretrained(name)
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        _model = AutoModelForCausalLM.from_pretrained(name, torch_dtype=torch.bfloat16).to(device)
        _model.eval()
    return _model, _tok


def model_translate(text, lang):
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import sarvam

    if sarvam.has_key() and not os.environ.get("SARVAM_LOCAL"):
        return sarvam.translate(text, lang)
    import torch

    model, tok = load()
    messages = [
        {"role": "system", "content": f"Translate the text below to {NAMES[lang]}."},
        {"role": "user", "content": text},
    ]
    prompt = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tok([prompt], return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=512, do_sample=False)
    ids = out[0][len(inputs.input_ids[0]):].tolist()
    return tok.decode(ids, skip_special_tokens=True).strip()


PLACEHOLDER = re.compile(r"\{[a-z]+\}")


def tidy(src, out):
    """Short labels shouldn't gain sentence punctuation the English doesn't have."""
    out = out.strip()
    if not re.search(r"[.!?…]$", src.strip()):
        out = re.sub(r"[।॥.]+$", "", out).strip()
    return out


_overrides = None


def overrides():
    global _overrides
    if _overrides is None:
        _overrides = json.load(open(OVERRIDES)) if os.path.exists(OVERRIDES) else {}
    return _overrides


def translate(text, lang, cache):
    fixed = overrides().get(lang, {}).get(text)
    if fixed:
        return fixed
    k = f"{lang}␟{text}"
    if k in cache:
        return tidy(text, cache[k])
    # protect {placeholders}: swap for digits the model leaves alone, then restore
    found = PLACEHOLDER.findall(text)
    masked = text
    for i, p in enumerate(found):
        masked = masked.replace(p, f"[{i + 7}]", 1)
    out = model_translate(masked, lang)
    for i, p in enumerate(found):
        out = out.replace(f"[{i + 7}]", p)
    if any(p not in out for p in found):
        print(f"  ! placeholder lost, keeping English: {text!r}")
        out = text
    cache[k] = out
    return tidy(text, out)


def load_cache():
    if os.path.exists(CACHE):
        with open(CACHE) as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE, "w") as f:
        json.dump(cache, f, ensure_ascii=False, indent=0)


def site_strings(content):
    """English strings of a site, in overlay shape."""
    en = lambda v: v["en"] if isinstance(v, dict) else v
    return {
        "name": en(content["name"]),
        "tagline": en(content["tagline"]),
        "intro": en(content["intro"]),
        "story": [en(s["text"]) for s in content.get("story", [])],
        "landmarks": [en(l["name"]) for l in content.get("landmarks", [])],
        "end": {"title": en(content["end"]["title"]), "body": en(content["end"]["body"])},
        "hotspots": {
            h["id"]: {"title": en(h["title"]), "body": en(h["body"]), "photos": [en(p["caption"]) for p in h.get("photos", [])]}
            for h in content["hotspots"]
        },
    }


def map_strings(obj, fn):
    if isinstance(obj, str):
        return fn(obj)
    if isinstance(obj, list):
        return [map_strings(x, fn) for x in obj]
    return {k: map_strings(v, fn) for k, v in obj.items()}


def main(langs):
    cache = load_cache()
    with open(os.path.join(ROOT, "src/i18n/ui.en.json")) as f:
        ui = json.load(f)
    sites = [d for d in os.listdir(os.path.join(ROOT, "src/sites")) if os.path.exists(os.path.join(ROOT, "src/sites", d, "content.json"))]
    for lang in langs:
        t0 = time.time()
        n = [0]

        def tr(s):
            n[0] += 1
            r = translate(s, lang, cache)
            if n[0] % 10 == 0:
                save_cache(cache)
                print(f"  {lang}: {n[0]} strings, {time.time() - t0:.0f}s")
            return r

        out = {k: tr(v) for k, v in ui.items()}
        with open(os.path.join(ROOT, f"src/i18n/ui.{lang}.json"), "w") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        for site in sites:
            with open(os.path.join(ROOT, "src/sites", site, "content.json")) as f:
                content = json.load(f)
            overlay = map_strings(site_strings(content), tr)
            with open(os.path.join(ROOT, "src/sites", site, f"content.{lang}.json"), "w") as f:
                json.dump(overlay, f, ensure_ascii=False, indent=2)
        save_cache(cache)
        print(f"{lang}: done, {n[0]} strings in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--test":
        print(model_translate(args[1], args[2]))
    else:
        main(args or ["hi", "or"])
