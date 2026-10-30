# Handoff — Walk India's Heritage (Konark)

Read this first in a new chat. It records what exists, how it fits together, the rules the
owner has set, and what is next. Paste: *"Read docs/HANDOFF.md and continue."*

## The product

A walkable 3D heritage experience in the browser. Flow (screen ids in `src/engine/store.ts`):

1. **entry** — `src/entry/Entry.tsx`: a sunlit stone hallway (scroll to walk), into a dim
   chamber; the camera settles over a stone platform.
2. **india** — the India map is *carved into that platform* (`CarvedSlab.tsx`, `carve.ts`,
   `indiaCarving.ts`), with a saffron-ringed, clickable Konark (`StoneMapUI.tsx`) and a
   "Back to the start" button (rewinds the camera down the hallway).
3. **overview** — still in the chamber: clicking Konark smooths India from the stone, carves
   Konark's plan and raises the real model as a miniature (built in a worker) — about 3 s — then
   the welcome scroll appears (`src/journey/Overview.tsx`). Orbit/zoom with damping; stops are
   gold wheels placed via DOM transforms; hover = compact scroll; click = enter at that stop.
4. **tour** — the walk (`src/engine/Experience.tsx`, mounted only when first entered, then kept)
   with a veil (`EnterVeil.tsx`) until its scene is ready (`store.sceneReady`), then a flight from
   the sky to the stop. 11 narrated stops; the story is docked to the right edge and hides to a
   tab with the stop's name; its player has previous/play/next stop and a track with one segment
   per sentence (click a segment, or a sentence in the text, to hear it from there); its tab
   always shows the stop's name, with a narration-progress ring. The corner map is also the
   compass (eight bezel directions, the one you face lit under the top mark, the sun); there is no top compass strip
  . A ⋯ button holds five icons (map, next, sound, language, leave).

**The story of Konark**: about a minute and a half, between the map and the miniature, once per
session (also "Watch the story" on the welcome scroll; `?screen=story&beat=N` for review). It is a
**paper-cut film rendered in Blender** (owner-approved install, Blender 5.2 LTS):
`tools/blender/paper.py` (card pieces from 2D outlines: extruded, bevelled, fibrous paper with a paler
cut edge and light through it; stage, camera with depth of field, area lights, gradient sky),
`tools/blender/figures.py` (articulated horse with a gallop, wheel, Surya, people, a detailed
Konark elevation in tiers), `tools/blender/story.py` (the six scenes). Render with
`sh tools/blender/render_all.sh [scene ...]` (EEVEE, 24 samples, ~3.5 s a frame; frames in
`tools/blender/out/`, git-ignored; encoded by ffmpeg to `public/sites/konark/story/scene-N.mp4` + a
poster jpg). Each scene's length comes from `tools/blender/durations.json`: the longest narration of
that line across en/hi/or plus a hold — re-measure it if the script changes. The web player
(`src/journey/paper/PaperReel.tsx`) plays the clips (crossfading, the next one preloading), and moves
on when both the clip and Shubh's narration (`narrateText(..., true)`, recorded voice only) are done;
captions follow the sentence. Without the clips it falls back to the three.js paper scenes in the same
folder (`kit.ts`, `figures.ts`, `shots.ts`). The chamber stays mounted but paused underneath.

Loading screens (`src/ui/Loader.tsx`): one big number counting to 100 with real progress (hall
ready; for the walk, `store.loadStage` 0 building → 1 lighting → `sceneReady`), a hairline beneath,
then the sheet lifts away. The hallway takes three scroll gestures (`entry/scroll.ts`).

## Stack

Vite 8, React 19, TypeScript, three 0.186, @react-three/fiber 9, drei 10, rapier 2.2,
@react-three/postprocessing 3.2, Howler, zod. Dev-only: agentation (feedback toolbar).
No GSAP. Python tools in `tools/` (venvs git-ignored).

## The owner's rules (keep them)

- Free and open-source only; **no new dependency, install or download without asking first.**
  (Blender was rejected; everything is done in three.js.) Don't delete files without being asked.
- Log every asset with source and licence in `CREDITS.md`. Mark legends as legends; don't
  invent facts; India's outline follows the official boundary.
- **No photo textures on the 3D model** — detail must be modelled. Photos are fine in the story
  panels and hover cards.
- Fonts: **only Cormorant Garamond (display) and DM Sans (text)** (`index.html`, `--display`,
  `--body` in `src/styles.css`). Hindi/Odia fall back to system fonts.
- Desktop first; phone later. Respect reduced motion. Audio off until first interaction.
- Work one piece at a time; screenshot and compare before moving on.

## How the 3D site is built (efficient on weak GPUs)

- **Builder** (`src/kit/builder.ts`): all static geometry merged per material and lightmap
  page; colliders for rapier. The Konark scene is built in a **Web Worker**
  (`sites/konark/build.ts` = pure geometry, `build.worker.ts`, `buildClient.ts`) so the page never
  stalls; the overview starts it in the background. Builds must stay deterministic (the bake
  depends on it): `resetFigures()` at the start of `buildKonark()`. Parts: `kit/parts.ts`, `kit/ratha.ts` (stepped *pancharatha*
  plans, `carvedTier` niche walls, pidha roof), `kit/geometry.ts` (wheel, amalaka, kalasha).
- **Sculpture** (`kit/sculpt.ts`, `kit/statues.ts`): signed-distance sculpting meshed with
  three's MarchingCubes (blocked and culled: ~0.1–0.2 s per statue). Statues seen up close get
  finer *detail regions* (heads), joined under a jewelled neck band so no seam shows — horses, war horse, war elephant, lions, gaja-simha, musicians/maidens
  (6 poses), relief figures, Surya, makara spouts. Preview: `/?sculpt=animals`, `/?sculpt=figures`.
- **Baked lighting** (`src/bake/*`, `kit/lightmap.ts`, `kit/StaticWorld.tsx`, `docs/BAKE.md`):
  sun visibility + sky/bounce light baked on the GPU in three.js into `public/sites/konark/bake/`.
  No live shadows or SSAO at runtime. **After any change to the Konark geometry, re-bake**
  (open `/?bake` with GPU Chrome; the review script dumps files; ~40 s). If the bake is stale the
  walk falls back to live lighting with a console warning.
  The higher-quality bake is Cycles, in the same format (true bounced light, trees included):
  `node tools/blender/export_konark.mjs` then `blender -b -P tools/blender/bake_light.py`
  (about an hour at 256 samples; `--pages 6 --samples 32 --no-vertex` for a quick look). The
  three.js bake it replaced is kept in `tools/blender/out/bake-threejs/`. To look at changed
  geometry before re-baking, add `?nobake` (dev only: live lighting).
- Carvings (`entry/carve.ts`): the groove normal map must stay gated by the reveal — three's
  `normal_fragment_maps` is still an `#include` in `onBeforeCompile`, so the chunk is expanded
  there. `uFade` smooths a whole carving away (India → Konark). Pins on the 3D maps are placed with
  the CSS `translate` property (not `transform`, which hover/animations also use). Stops that
  would overlap fan out around their group (`src/ui/declutter.ts`) — on the Konark model (with
  leader lines), the walk's aerial map and the corner map.
- Hover states darken, never lighten (global `button:hover` in `src/styles.css`; see-through hit
  areas are excluded).
- Konark overview camera (`KonarkCamera` in `Entry.tsx`) frames the miniature's bounds
  (`mapState.model`); the Rig eases a camera view offset so the picture sits right of the scroll.
- Trees (`kit/Trees.tsx`): clumped broadleaf crowns on forked trunks, wispy casuarinas, coconut
  palms, and one banyan with prop roots (`banyanPlacement`). They cast baked shadows: change
  them → re-bake.
- Stone view (`StoneTablet.tsx`): no shadow maps or post-processing (CSS vignette, a soft
  ground-shadow texture); pins positioned via DOM transforms, not React state.
- Budget now: ~2.0M static triangles (temple + sculpture), ~0.53M trees; bake ~5 MB.

## Review tooling (in the session scratchpad, not the repo)

A CDP driver `shot.mjs` drives Chrome for Testing (playwright cache) — `GPU=1` uses the Mac
GPU. Actions: `wait`, `shot`, `eval`, `key`, `click`, `clickSel`, `hoverSel`, `until`, `dump`.
Useful URLs: `?shot&quality=high&screen=tour&stop=N`, `?screen=overview`, `?screen=india`.
`window.__store`, `__scene`, `__camera`, `__THREE` are exposed with `?shot`. A full click-through
test (entry → map → Konark → overview → stone/3D → back → walk) passed with no errors.

## Voice

- Narration plays per-sentence clips from `public/sites/konark/vo/` (`vo/manifest.json` lists the
  exact text of each clip and, under `_voices`, the speaker), else the device voice.
- **Sarvam AI** (owner's account; key in `.env.local` as `SARVAM_API_KEY`, git-ignored) is the voice
  for all three languages: Bulbul v3, `tools/voice/sarvam_tts.py`. Speaker comparisons:
  `--samples` writes `tools/voice/samples/<lang>-<speaker>.mp3` (git-ignored). Current speaker:
  `shubh` (Sarvam's default) until the owner picks one; switching is one re-run with `--speaker`.
  Re-run after any narrated text changes (only changed sentences are regenerated).
- Translation goes through the same key (`tools/i18n/translate.py`, `sarvam-translate:v1`).
- ElevenLabs and Indic Parler-TTS scripts remain as alternatives (unused).

## Languages

22 Indian languages registered (`src/i18n/languages.ts`); en/hi/or enabled. UI strings in
`src/i18n/ui.*.json` (Hindi/Odia via local Sarvam-Translate + `tools/i18n/overrides.json`
corrections). Site text overlays: `src/sites/konark/content.<lang>.json`. Needs native review.

## Next up (owner's list, in order)

1. **The Konark story**: rounds 1–2 done (all six scenes, narration, flow). Next rounds: richer
   figures (faces, jewellery, drapery), the build scene's ramp and haulers, transitions between
   scenes (a paper wipe), sound design (waves, hooves, chisels), and a full timing pass with voice.
2. The temple model, in rounds. Round 1 done: carved stone sculpted offline
   (`tools/blender/relief.py` → `public/sites/konark/tex/`, swapped into the materials at high
   quality by `loadStoneDetail`): plinth friezes with dancers, musicians and elephants, weathered
   ashlar. Round 2: four frieze designs in one atlas (each 4-band-height tile picks one; couples,
   musicians, horsemen, geese, a hunt), parallax depth on frieze and wall (`patchDetail`,
   near the eye only), the Cycles light bake, deeper niche frames with banded pilasters, pidha
   slabs with rounded overhanging drips and a miniature shrine on each raha, carved kanthi bands
   between the roof tiers. Next: sculpture close-up detail.
3. Scenery, round 1 done: a painted sky dome (`Atmosphere.tsx`: gradient, sun glow, drifting
   clouds; its horizon is the fog colour), leaf-card foliage on broadleaf trees, shrubs and the
   banyan (`leafCards` in `kit/Trees.tsx`, a generated leaf texture), lawn variation across the
   grounds (`patchDetail('lawn')`), the loader portalled above every control. Tree changes →
   re-export and re-bake (leaf cards are bake occluders).
4. **Website pass** done: the story clips re-encoded at half the size (`tools/blender/encode_story.sh`,
   CRF 23, capped at 3.5 Mbit/s; story.py uses the same settings); the walk's carved-stone
   textures stream in after the walk is showing, one set at a time (`loadStoneDetail`), so the
   lighting isn't held up; ambience and music no longer go silent on 48 kHz devices (Howler's
   auto-unlock replaced its context under us: `Howler.autoUnlock = false` in `engine/audio.ts`);
   the map's tablet is one sculpted sandstone the size of the slab (`tools/blender/entry_stone.py` →
   `public/entry/slab-*`; its surface is folded into the carving's normals by `bakeCarving`), with
   softer chisel cuts and the sea and river names moved off the border and off each other; no
   letter-spacing on Hindi/Odia text. Production preview: `.claude/launch.json` "konark-prod"
   (`npm run build` first) on :5299.
5. **Photoreal pass** on the whole visible site, in rounds. Round 1: the gaja-simha re-sculpted
   (a kneeling elephant with a real head, domed brow, ears, tusks and a ringed trunk; a heavier
   lion with snail-curl mane rings, open jaws and fangs, used on the roof lions too) and the
   horses' legs made stockier with knees, hocks and hooves (`kit/statues.ts`; review at
   `/?sculpt=guards`). Sculpture light re-baked per vertex only (`bake_light.py --pages`, the
   lightmap pages were not re-baked; old vertex bake in `tools/blender/out/bake-before-statues/`).
   Round 2, trees and grass, modelled and rendered in Blender (`tools/blender/foliage.py`, then
   `foliage_post.py`; textures in `public/foliage/` and `tex/lawn-*`): leaf clusters (folded
   leaves on twigs, with the occlusion between them, plus a normal map) and casuarina needles
   replace the drawn canvases (`upgradeTexture` in `kit/Trees.tsx` swaps them in once loaded);
   coconut palms rebuilt (a slender ringed trunk instead of a cone, two tiers of Blender fronds,
   coconuts); shrubs and broadleaf crowns carry more leaf cards over darker cores; the lawns are
   a 5 m tile of 250,000 blades seen from above (streamed in by `loadStoneDetail`); and 3D grass
   tufts stand on every lawn (`kit/Grass.tsx`: crossed cards lit by the lawn's own bake at the
   root, swaying, shrinking away past 30 m; high quality only). Light re-baked in Cycles for the
   new trees (128 samples; the previous bake is in `tools/blender/out/bake-before-foliage/`).
   Round 3 (after review: crowns read as balls and discs, bushes as pasted on, trees vague):
   the solid core of every crown and bush carries the leaf render mapped from three sides and
   takes little sun (`coreMaterial`), so gaps show deeper leaves, not a smooth ball; leaf cards
   stand out from the crown at varied depths (`leafCards` scatter) and the banyan canopy is 38
   smaller masses, so no clean round rim is left; cut-out leaves keep their coverage as the
   texture shrinks into small mipmaps (`leaf-coverage`), so distant crowns stay full; bushes
   settle into the lawn as mounds with shaded undersides; bark (`tools/blender/bark.py`) mapped
   by world position on every trunk (`barkMaterial`); the banyan's trunk is fluted and flared,
   its hanging roots knotted, wandering and flared at the ground (some in twos and threes),
   its limbs tapered and bent. Shader patches chain through `patch()` in `kit/Trees.tsx`.
   Review any spot with `?stop=1&view=x,z,lookX,lookY,lookZ`.
   Round 4, the dance hall: every face of the nata mandir's sixteen pillars carries tiers of
   dancers and musicians in deep relief, each framed by a ledge, pilasters, a lintel and a small
   crown (`carvedPillar` in `kit/ratha.ts`), and the pieces that fell from the broken pillars lie
   about the platform, off the aisles. (Narasimha in the owner's list is the gaja-simha, done in
   round 1.) Review URLs take a ground height too: `view=x,y,z,lookX,lookY,lookZ`.
   Round 5: the audience hall's dark bands fixed (the `recess` stone was near-black; now a
   shadowed khondalite, the bake gives the depth); distant views: the land beyond the walls out
   to 8 km (groves, casuarina, palms, villages, fields, the sea 3 km ESE) modelled and rendered in
   Blender as a horizon band (`tools/blender/distant.py`, `distant_post.py` →
   `public/sites/konark/horizon/`), hung on a ring that travels with the eye and hazed by the
   walk's own fog at each pixel's true distance (`kit/Horizon.tsx`); the morning haze thinned so
   tree lines show. Light re-baked for the carved pillars. Renders and bakes run at low priority
   (`nice -n 20`): the owner's laptop heats up under them.
   Round 6: casuarinas rebuilt as the coastal plantation trees are (a straight trunk, 24 thin
   branches spiralling up it, each hung with tufts of drooping branchlets rendered in Blender:
   `branchlet` in foliage.py), an open crown built at 17 m and scaled per tree. Fixed for all
   foliage: two-sided cards had their normal flipped on the back face, so half of every crown
   glowed pale against the light and half went black (`keepCrownNormals`; the grass tufts too);
   the walk's canvas is opaque. The light bake still has the old casuarina crowns as shadow
   casters (outside the east gate only): re-bake at the next geometry change.
6. Phone layout, round 1 (`@media (max-width: 640px)` at the end of `styles.css`, plus
   `loader.css` and `entry.css`): the walk's story is a bottom sheet (56vh) with its handle on
   top, the map and compass shrink to the top-left, the joystick hides under an open sheet,
   the loader's two labels stack, the hall's hint reads "Swipe up to walk in" on touch screens.
   The hall, the map, the story film and the overview already fit a phone. Still to check on a
   real device: performance, and the overview's stop pins (clipped at the left edge).
   SEO and sharing: title, description, Open Graph/X tags with a share image from the story
   film (`public/og.jpg`), JSON-LD, the wheel favicon (`favicon.svg` and PNGs), a web manifest;
   `sitemap.xml` and `robots.txt` are written at build. Their absolute URLs come from `SITE_URL`
   or Vercel's `VERCEL_PROJECT_PRODUCTION_URL` (vite.config.ts `siteMeta`).
   Analytics: Vercel Analytics (`<Analytics />` in main.tsx; enable it in the Vercel project),
   with custom events `screen` and `stop_opened` (`engine/actions.ts`).
   Performance: broadleaf trees beyond ~50 m of the enclosure (and all of them on a phone) use a
   light crown (450 leaf cards, not 1,700), and the forest is drawn in eight sectors so trees
   behind the eye are culled (`BroadleafTrees`); phones get lighter shrubs and the sculpture
   clustered to ~6 cm in the build worker (`scene-low`; lit live, a shade darker); resolution is
   capped at 1.5x (1.25x on a phone) and steps down to 1x when the frame rate falls
   (`PerformanceMonitor` in `Experience.tsx`). Phone frame: 4.1M → 1.6M triangles.
7. Other sites (Red Fort, Taj Mahal, Hampi, …) — currently names on the map only.
