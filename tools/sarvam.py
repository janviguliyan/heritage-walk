"""Shared Sarvam AI API client (translation and speech). Standard library only.

API key: put SARVAM_API_KEY=... in .env.local at the project root (git-ignored), or export it.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
API = "https://api.sarvam.ai"
# the app's language ids -> Sarvam's
CODES = {"en": "en-IN", "hi": "hi-IN", "or": "od-IN", "bn": "bn-IN", "gu": "gu-IN", "kn": "kn-IN", "ml": "ml-IN", "mr": "mr-IN", "pa": "pa-IN", "ta": "ta-IN", "te": "te-IN"}


def api_key():
    k = os.environ.get("SARVAM_API_KEY")
    p = os.path.join(ROOT, ".env.local")
    if not k and os.path.exists(p):
        for line in open(p):
            if line.strip().startswith("SARVAM_API_KEY="):
                k = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not k:
        sys.exit("No SARVAM_API_KEY: add it to .env.local.")
    return k


def has_key():
    try:
        return bool(api_key())
    except SystemExit:
        return False


def call(path, body):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), headers={"api-subscription-key": api_key(), "Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:400]
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(4 * (attempt + 1))
                continue
            sys.exit(f"Sarvam {e.code}: {msg}")


def translate(text, lang):
    r = call("/translate", {"input": text, "source_language_code": "en-IN", "target_language_code": CODES.get(lang, f"{lang}-IN"), "model": "sarvam-translate:v1", "numerals_format": "international"})
    return r["translated_text"]


def speak(text, lang, speaker, model="bulbul:v3", pace=0.92, temperature=0.5):
    """MP3 bytes for one piece of text."""
    r = call("/text-to-speech", {"text": text, "language_code": CODES[lang], "speaker": speaker, "model": model, "pace": pace, "temperature": temperature, "speech_sample_rate": 44100, "output_audio_codec": "mp3"})
    return base64.b64decode(r["audios"][0])
