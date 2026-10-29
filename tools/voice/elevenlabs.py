"""English narration in an Indian voice with ElevenLabs, offline (generated once, shipped as mp3).

Same output as generate.py: one clip per sentence at public/sites/<site>/vo/<lang>/<key>-<n>.mp3,
listed with its exact text in vo/manifest.json (the app plays a clip only if its text still
matches). Re-running only generates what is missing or changed. Standard library only.

API key: put ELEVENLABS_API_KEY=... in .env.local at the project root (git-ignored), or export it.

  python3 tools/voice/elevenlabs.py --list                 # Indian-accent English voices to choose from
  python3 tools/voice/elevenlabs.py --voice <voice_id>     # generate all English narration
  python3 tools/voice/elevenlabs.py --voice <id> --only reel-0 arrival   # just some stories
  python3 tools/voice/elevenlabs.py --voice <id> --sample "Welcome to Konark."   # one test clip

Licence note: on ElevenLabs' free plan the audio is non-commercial and must credit
ElevenLabs; a paid plan gives a commercial licence. CREDITS.md records which applies.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from generate import ROOT, split_sentences, stories  # noqa: E402

API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
# calm museum-guide delivery: steady, warm, unhurried
SETTINGS = {"stability": 0.55, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True, "speed": 0.94}


def api_key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    p = os.path.join(ROOT, ".env.local")
    if not k and os.path.exists(p):
        for line in open(p):
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                k = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not k:
        sys.exit("No ELEVENLABS_API_KEY: add it to .env.local (see the top of this file).")
    return k


def call(path, body=None, query=None, raw=False):
    url = API + path + ("?" + urllib.parse.urlencode(query) if query else "")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"xi-api-key": api_key(), "Content-Type": "application/json", "Accept": "audio/mpeg" if raw else "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read() if raw else json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:400]
            if e.code == 429 and attempt < 3:
                time.sleep(5 * (attempt + 1))
                continue
            sys.exit(f"ElevenLabs {e.code}: {msg}")


def list_voices():
    """Indian-accent English voices: your own library first, then the shared Voice Library."""
    mine = call("/voices")["voices"]
    for v in mine:
        lab = v.get("labels") or {}
        if "indian" in (lab.get("accent") or "").lower():
            print(f"[library] {v['voice_id']}  {v['name']}  {lab}")
    shared = call("/shared-voices", query={"accent": "indian", "language": "en", "page_size": 40, "sort": "usage_character_count_1y"})
    for v in shared.get("voices", []):
        print(f"[shared]  {v['voice_id']}  owner={v['public_owner_id']}  {v['name']}  {v.get('gender')}/{v.get('age')}  {v.get('use_case')}  {v.get('descriptive')}")
    print("\nTo use a shared voice, add it once:  --add <owner_id> <voice_id>")


def add_shared(owner, voice_id, name):
    r = call(f"/voices/add/{owner}/{voice_id}", body={"new_name": name})
    print("added to your library:", r)


def speak(text, voice, out_mp3, prev=None, nxt=None):
    body = {"text": text, "model_id": MODEL, "voice_settings": SETTINGS}
    # neighbouring sentences keep the intonation continuous across clips
    if prev:
        body["previous_text"] = prev
    if nxt:
        body["next_text"] = nxt
    audio = call(f"/text-to-speech/{voice}", body=body, query={"output_format": "mp3_44100_64"}, raw=True)
    with open(out_mp3, "wb") as f:
        f.write(audio)


def reel_lines():
    """The story reel's four lines (keys reel-0..3), from the English UI strings."""
    with open(os.path.join(ROOT, "src", "i18n", "ui.en.json")) as f:
        ui = json.load(f)
    for i in range(4):
        yield f"reel-{i}", split_sentences(ui[f"reel.{i + 1}"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--add", nargs=2, metavar=("OWNER_ID", "VOICE_ID"))
    ap.add_argument("--voice")
    ap.add_argument("--site", default="konark")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--sample")
    a = ap.parse_args()
    if a.list:
        return list_voices()
    if a.add:
        return add_shared(a.add[0], a.add[1], "Konark narrator")
    if not a.voice:
        sys.exit("Choose a voice with --voice (see --list).")
    if a.sample:
        out = os.path.join(ROOT, "tools", "voice", "sample.mp3")
        speak(a.sample, a.voice, out)
        return print("wrote", out)

    site_dir = os.path.join(ROOT, "src", "sites", a.site)
    vo = os.path.join(ROOT, "public", "sites", a.site, "vo")
    man_path = os.path.join(vo, "manifest.json")
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    os.makedirs(os.path.join(vo, "en"), exist_ok=True)
    done = manifest.setdefault("en", {})
    voices = manifest.setdefault("_voices", {})
    chars = 0
    for key, sentences in [*stories(site_dir, "en"), *reel_lines()]:
        if a.only and key not in a.only:
            continue
        same_voice = voices.get(f"en/{key}") == a.voice
        if same_voice and done.get(key) == sentences and all(os.path.exists(os.path.join(vo, "en", f"{key}-{i}.mp3")) for i in range(len(sentences))):
            continue
        old = done.get(key) or []
        for i, s in enumerate(sentences):
            path = os.path.join(vo, "en", f"{key}-{i}.mp3")
            if same_voice and i < len(old) and old[i] == s and os.path.exists(path):
                continue
            speak(s, a.voice, path, sentences[i - 1] if i else None, sentences[i + 1] if i + 1 < len(sentences) else None)
            chars += len(s)
        done[key] = sentences
        voices[f"en/{key}"] = a.voice
        with open(man_path, "w") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)
        print(f"en {key}: {len(sentences)} clips", flush=True)
    print(f"done; {chars} characters sent to ElevenLabs")


if __name__ == "__main__":
    main()
