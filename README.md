# Walk India's heritage — Konark Sun Temple

A browser-based journey into India's heritage sites, starting with the Konark Sun Temple. You walk down a sunlit stone hallway into a chamber, where a map of India is carved into a stone platform (the external boundary follows the Survey of India). Click Konark: India is smoothed away, the temple's plan is carved in its place and the temple rises as a stone miniature. From there you walk a first-person 3D recreation of the temple, with eleven narrated stops. The spec is in [`docs/BRIEF.md`](docs/BRIEF.md); the current state and the owner's rules are in [`docs/HANDOFF.md`](docs/HANDOFF.md).

```bash
npm install
npm run dev        # http://localhost:5173 (with the agentation feedback toolbar, bottom-right)
npm run build      # typecheck + production bundle in dist/ (agentation is never included)
```

## The journey

1. **Hallway** (`src/entry/Entry.tsx`). Scroll to walk in; the camera settles over the stone platform.
2. **India map** (`src/entry/CarvedSlab.tsx`, `StoneMapUI.tsx`). India is carved into the stone as you watch. Konark is live; faint names are coming soon. Clicking Konark plays the story.
3. **The story** (`src/journey/paper/PaperReel.tsx`). A paper-cut film rendered in Blender (`tools/blender/story.py`), narrated by Shubh. Skippable (Esc); plays every time, and again from **Watch the story**.
4. **Konark** (`src/journey/Overview.tsx`). The temple in miniature with its stops as gold wheels: orbit, hover a wheel for its story line, click to start there, or **Begin the walk**.
5. **The walk** (`src/engine/`). The 3D temple, built in a background thread while you look at the miniature; you arrive by flying down from the sky.

## Languages

English, Hindi and Odia are live. Switch at any time from the language pills on the journey pages, or the language menu in the walk. Narration restarts in the new language. All 22 scheduled languages are listed in `src/i18n/languages.ts`, ready to enable.

- **Text.** UI strings are in `src/i18n/ui.<lang>.json` and site content is in `src/sites/<site>/content.<lang>.json` (one overlay file per language). Both are generated from English with **Sarvam-Translate**, through Sarvam's API when `SARVAM_API_KEY` is in `.env.local`, otherwise with the open weights locally:
  `python3 tools/i18n/translate.py hi or`
- **Voice.** Narration is generated offline with **Sarvam's Bulbul** (one Indian voice family for English, Hindi and Odia), one clip per sentence, so highlighting, seeking and pause work per sentence:
  `python3 tools/voice/sarvam_tts.py --samples` (compare speakers), then `python3 tools/voice/sarvam_tts.py --lang en hi or --speaker <name>`.
  Clips land in `public/sites/konark/vo/` with a manifest. A clip only plays if its text still matches, otherwise the device's own voice reads the text. Nothing calls Sarvam at runtime.
- **Native review.** Every translation needs review by a native speaker before launch.

## Controls

| | Desktop | Touch |
| --- | --- | --- |
| Walk | W A S D / arrow keys, Shift to run | Left joystick (push fully to run) |
| Look | Mouse (click the scene to capture, Esc to release) | Drag anywhere else |
| Open a stop | E, or click a glowing wheel | Tap the "Tap — …" prompt |
| Map from the sky | M, or the map in the ⋯ menu · click a numbered pin to fly there | Same |
| Next stop (guided glide) | N, or the next button in the story player | Same |
| Story: replay / pause / hide | R / P / H · click a sentence or a track segment to hear it from there | Panel buttons |
| Sound on/off | V | ⋯ menu |
| Language | ⋯ menu | Same |

**The corner map** is also the compass: the direction you face is lit under the top mark, and the sun shows where it stands.

**The story panel** is docked to the right edge. It has real photographs (Wikimedia Commons, credited on screen; click to enlarge), the story with the spoken sentence highlighted, and a player: previous stop, play/pause, next stop, and a track with one segment per sentence. Hide it to a tab with the stop's name and a progress ring; narration keeps going. Every story is also on screen, so sound is optional.

## What's built

- **Engine** (`src/engine/`): a Rapier capsule character controller with collisions and walkable stair ramps; pointer-lock and touch look; guided glides along route waypoints (rising over walls if you're off-route); hotspots loaded from a zod-validated JSON file; a corner map that is also the compass; a stop counter; a ⋯ menu (map, next, sound, language, leave); a docked story panel with Legend/Tradition badges and a per-sentence player; and a "then and now" end screen.
- **Atmosphere**: a sunrise that climbs as you visit stops; fog, sky-lit ambient light, sun glow, birds and drifting sand. Lighting is baked on the GPU in three.js (`docs/BAKE.md`), so there are no live shadows to pay for at runtime.
- **Kit** (`src/kit/`): parametric parts (plinth mouldings, 16-spoke wheel, rearing horse, gaja-simha, pidha roof, amalaka, kalasha, pillars, stairs with ramp colliders, Surya figure in a niche, ruined walls, rubble, gate towers, walls). The whole static scene merges into one mesh per material, about 40 draw calls in total. The 24 wheels are one instanced mesh, and the casuarina trees are instanced and sway in the wind.
- **Konark** (`src/sites/konark/`): the enclosure and east gate, the nata mandir with broken pillars, the gaja-simha pair, the chariot plinth with 24 wheels and 7 horses (several broken), the sealed jagamohana (about 36 m), the deul ruin with three chlorite Surya niches, and the Mayadevi Temple. A gold, labelled conjectural reconstruction of the tower appears on the end screen.
- **Sound**: sea, wind, birds and footsteps on sand or stone, with stone reverb near the halls. There's generated music in an Odissi idiom (a drone, a bamboo-flute line in raga Bhupali and a mardala-style drum). Audio starts only after the first click.

## Adding a new site

1. Copy `src/sites/konark` to `src/sites/<site>`.
2. Rebuild `scene.tsx` from kit parts (1 unit = 1 m, +X east, −Z north).
3. Rewrite `content.json`. Each hotspot has a `position` (marker), a `view` (where the visitor stands and what they look at), `via` waypoints for guided glides, titles, body text and `legend`/`tradition` flags.
4. Draw the site's hand-drawn `Plan` and prologue `StoryArt` (see `src/sites/konark/Plan.tsx` and `StoryArt.tsx`), and write its `story` scenes in `content.json`.
5. Add the place to `src/world/places.ts` with its latitude and longitude, then export a `SiteDefinition` from `index.ts` and pass it to `<Journey site={…} />` in `src/main.tsx`.
6. Run the translation and voice tools for the new content.

## Review shortcuts

(These skip the journey pages.)

- `?stop=N` starts at stop N (1–11), skipping the intro.
- `?end` opens the end screen with the reconstruction.
- `?quality=low|high` forces a quality level.
- `?screen=india|overview|story` opens the carved map, the Konark miniature or the story reel.
- `?lang=hi|or|en` picks the language.
- `?shot` keeps the WebGL buffer and logs state, for headless screenshots.

## Still to do (from the brief)

- **Narration**: generated with Sarvam (see Languages). Re-run the voice tool after any text change.
- **Hindi and Odia text**: every translated string is a machine draft and and needs a native speaker's check.
- **Facts to verify**: see the checklist in the brief. In particular, the positions and footprints of the nata mandir, Mayadevi Temple and gates are approximate.
- **Photos**: 19 photographs are in place (2 per stop, 1 for the legend). Their captions are short and conservative; it's worth checking each one against its Commons page.
- **Optional detail**: CC0 Poly Haven/ambientCG textures, Freesound ambience, and a TRELLIS mesh for one wheel or horse. Log each in `CREDITS.md`.
- **Phone testing on real hardware**: the layout and touch controls were checked in an emulated phone viewport only.
- **Bundle size**: about 1.4 MB gzipped, mostly the Rapier physics WASM. Code-splitting could speed up first load.
