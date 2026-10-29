# Konark Sun Temple — Walkable 3D Experience: Build Brief

Oct 14, 2026 · @Janvi

## The brief

Build a browser-based, first-person walk through the Konark Sun Temple in Odisha, India, recreated as a stylised 3D world built entirely in code. Visitors walk from the entrance through the temple complex, and glowing hotspots tell the history, legends and meaning of each spot. It replaces a human guide for people planning a trip, or standing at the site itself.

This is the first site of a wider idea: walkable, story-led tours of heritage sites where photography or footage is limited (Karla Caves is the next example). The engine must therefore be reusable — a new site should mostly mean a new scene and a new content file.

**Hard constraints**

- **Free and open source only.** No paid assets, APIs, accounts or services. Every dependency and asset must carry an open licence (MIT, Apache-2.0, BSD, OFL, CC0, CC BY). Record each in a credits file.
- **Secure installs.** Official npm/PyPI registries and official GitHub repos only; pinned versions; run `npm audit`; no unknown binaries or install scripts from unvetted packages.
- **Time:** 1–2 days of build time for a working, polished first version.
- **Stylised, not photoreal.** Atmosphere comes from lighting, scale, sound and story, not photographic texture. Fine carvings are suggested by form, normal maps and decals.
- **Accurate history.** The layout and stories must be faithful; anything uncertain is labelled as legend or tradition.
- **Runs in a browser** on a mid-range laptop and a recent phone; non-commercial for now.

## The site

Konark is a 13th-century temple to Surya, the Sun god, built as a giant stone chariot: twelve pairs of carved wheels along its sides, drawn by seven horses. It was built under King Narasimha Deva I of the Eastern Ganga dynasty (reigned 1238–1264) on the Bay of Bengal coast, about 35 km from Puri, and inscribed as a UNESCO World Heritage Site in 1984 ([UNESCO](https://whc.unesco.org/en/list/246/)).

**Layout (model this):** an east-facing complex inside a rectangular enclosure wall with gates. From east to west: the nata mandir (dance hall) on a high, now roofless platform; the jagamohana (audience hall), the big pyramid-roofed structure that dominates today; then the ruined base of the deul (main sanctuary), whose tower fell in the 19th century. Subsidiary structures, including the Mayadevi Temple, sit within the enclosure. Site centre: 19°53′15″ N, 86°05′41″ E; protected area about 10.6 ha.

| Element | Model as | Approx. size (verify) | Material and colour |
| --- | --- | --- | --- |
| Enclosure wall and east gate | Low perimeter wall, gate towers | Encloses the whole complex | Weathered laterite, rust-brown |
| Nata mandir | Raised platform, pillar stubs, no roof | High plinth | Khondalite, grey-ochre |
| Gaja-simha (lion over elephant) statues | Two guardian sculptures at the east steps | Larger than life | Khondalite |
| Seven horses | Rearing horse figures at the east front of the chariot | Life size or larger; several broken | Khondalite |
| Chariot plinth | Long platform carrying jagamohana and deul | Runs the length of both | Khondalite, densely carved friezes |
| 24 wheels | 12 per side on the plinth (north and south) | \~3 m diameter; 8 major + 8 minor spokes | Khondalite |
| Jagamohana | Square hall with stepped (pidha) pyramid roof, three tiers, crowned by amalaka and kalasha | \~30–39 m high (sources differ) | Khondalite; interior sealed with sand in 1903 |
| Deul ruin | Square base and broken lower walls behind the jagamohana | Original tower est. 60–70 m | Khondalite and laterite core |
| Surya images | Three niches on the deul exterior | Larger than life | Green chlorite (dark, polished) |
| Mayadevi Temple | Smaller ruined temple to the south-west | Small | Laterite and khondalite |

Three stones were used: chlorite, khondalite and laterite ([MasterClass](https://www.masterclass.com/articles/konark-sun-temple-history-and-architecture)). The landscape is coastal: sand, casuarina trees and lawns. The sea is no longer visible from the temple.

## Walk route and hotspots

The visitor arrives at dawn from the east, as the first sunlight would, and walks west towards the sanctuary. Ten hotspots; the first build needs all ten as text, with narration where time allows. Each card has a title, a 2–3 sentence story, and an optional “legend” tag.

| # | Hotspot | Story told there |
| --- | --- | --- |
| 1 | Arrival at dawn (east gate) | “Konark” joins *kona* (corner) and *arka* (sun). Built around 1250 CE by Narasimha Deva I, the temple faces east so sunrise reaches the entrance. European sailors used its dark mass as a landmark and called it the Black Pagoda. |
| 2 | Gaja-simha guardians | Lions crushing elephants guard the steps — often read as pride over wealth, or the kingdom’s power. A set-piece of Kalinga sculpture. |
| 3 | Nata mandir (dance hall) | Temple dancers performed here for the god. Its walls are covered in musicians and dancers; the tradition lives on in Odissi dance and the Konark Dance Festival held here. |
| 4 | The seven horses | The Sun’s chariot is pulled by seven horses — commonly linked to the seven days of the week or the seven colours of light. Several are broken; the visitor sees what survives. |
| 5 | A wheel up close | 24 wheels, about 3 m across, each carved differently. Tradition holds the wheels work as sundials, read from the shadow of the spokes. One of these wheels appears on India’s ₹10 note. |
| 6 | The plinth friezes | Thousands of figures: hunting, war, music, daily life and mithuna (loving couples). A stone encyclopedia of 13th-century Odisha. |
| 7 | Jagamohana | The audience hall that still stands. In 1903 it was filled with sand and sealed to stop it collapsing; the ASI began removing the sand in September 2022. |
| 8 | Surya images (chlorite) | Three green-stone Surya figures on the sanctuary walls — tradition associates them with the rising, midday and setting sun. |
| 9 | The fallen tower | The deul once rose to perhaps 60–70 m. Why it fell is debated: weak foundations on sand, salt weathering, invasion, or abandonment. |
| 10 | Legend of Dharmapada | *Legend:* 1,200 artisans worked 12 years under master builder Bisu Maharana. When they could not set the crowning stone, his young son Dharmapada did it — then sacrificed himself to save the workers from the king’s anger. |

Optional end screen: a short “then and now” — the complex with the reconstructed tower fading in, labelled clearly as a reconstruction.

## Look, sound and feel

The mood is a sunrise pilgrimage: warm low light, long shadows, mist off the sea, and stone that glows as the sun climbs. Stylised but grounded — think a painterly game, not a cartoon.

**Lighting and world**

- Time of day starts at dawn and slowly brightens over the walk; the sun rises in the east behind the visitor, then lights the jagamohana face.
- Soft fog, warm sky gradient, gentle bloom on the sun, ambient occlusion so carvings read.
- Wind in casuarina trees, drifting sand particles, birds crossing the sky.

**Palette**

- Khondalite stone: warm grey-ochre. Laterite: rust-brown. Chlorite: deep green-black with a soft sheen.
- Sky: dawn saffron to pale blue. Accent for UI and hotspots: sun-gold.

**Hotspots and UI**

- Hotspot marker: a small glowing chakra (wheel) icon that slowly turns; brighter as you approach.
- Card: title in English with Odia script beneath, story text, “Legend” badge where relevant, narration play button.
- Minimal HUD: compass with the sun’s direction, a stop counter (3/10), and a guided/free-walk toggle.
- Patterns from Odia temple art for borders and loaders: lotus, wheel spokes, scrolling vines.

**Type**

- Display: a serif with an Indian feel (e.g. *Tiro Devanagari Latin* or *Yatra One*); body: *Noto Sans*; Odia captions: *Noto Sans Oriya*. All on Google Fonts under the OFL.

**Sound**

- Ambient bed: sea and wind at the gate, footsteps on stone, birds; reverb near the jagamohana.
- Music: soft instrumental in an Odissi idiom (flute, mardala-style drum, veena), only from CC0 or CC BY sources, or generated.
- Narration: open-source text-to-speech (Piper, MIT licence) in English first; Hindi and Odia later.
- Audio starts only after the first click; always provide a mute toggle and on-screen text.

## Tech stack and modelling

A Vite + React + TypeScript app using React Three Fiber, with the temple built procedurally from a small kit of reusable parts. All libraries below are open source (MIT unless noted); check current versions before installing.

| Need | Use |
| --- | --- |
| App and build | Vite, React, TypeScript |
| 3D | three.js via `@react-three/fiber` and `@react-three/drei` |
| Walking and collisions | `@react-three/rapier` (physics, capsule character controller) + drei `PointerLockControls` / `KeyboardControls` |
| Look | `@react-three/postprocessing` (bloom, SSAO, tone mapping, vignette), drei `Sky`, fog, instanced trees |
| Motion | GSAP for camera glides and UI |
| Audio | Howler.js |
| Content | One JSON file per site, typed with zod |
| Optional detail meshes | TRELLIS (image-to-3D, MIT) run offline for one wheel or horse; export glTF, compress with gltf-transform (MIT) |

**Modelling the temple in code**

- Build a kit of parametric parts: `Plinth` (stacked mouldings), `Wheel` (rim, hub, 8 major and 8 minor spokes, medallions), `Horse` (simplified rearing form), `PidhaRoof` (three tiers of stepped slabs separated by recessed bands), `Amalaka` (ribbed disc), `Kalasha` (finial), `Wall` with niches, `Pillar`, `Stairs`, `Statue` (gaja-simha block-out).
- Assemble with real proportions from the site table. One scene unit = 1 m. Use instancing for the 24 wheels and repeated mouldings.
- Fake carving detail with tiling stone textures, normal maps, and decal strips of relief patterns along friezes; keep geometry light.
- Simple collision shapes (boxes and cylinders) for everything walkable; climbable stairs where the real site allows.
- Bake lighting where it helps; target 60 fps on a mid-range laptop and 30 fps on phones, with a lower-quality mode.

**Controls**

- Desktop: WASD/arrows to walk, mouse to look, Shift to run, E or click to open a hotspot.
- Mobile: virtual joystick and drag-to-look; “Next stop” auto-walks along the route.
- Guided mode: the camera glides stop to stop with narration; Free mode: walk anywhere.

**Structure (reusable for the next site)**

```text
src/engine/      player, physics, hotspots, audio, UI, quality settings
src/kit/         parametric temple parts
src/sites/konark/scene.tsx      assembles Konark from kit parts
src/sites/konark/content.json   hotspots, text, audio, credits
public/sites/konark/            textures, audio, images
CREDITS.md       every asset with licence and link
```

**Hotspot content format**

```json
{
  "id": "wheel",
  "position": [18.0, 1.6, -9.5],
  "title": { "en": "A wheel that tells time", "or": "ସମୟ କହୁଥିବା ଚକ୍ର" },
  "body": "24 wheels, about 3 m across...",
  "legend": false,
  "audio": "vo/wheel.mp3",
  "image": "img/wheel-cc-by.jpg"
}
```

The Odia title above is a placeholder; have a native speaker check every Odia string.

## Free assets and licences

Only CC0, CC BY, OFL or permissive code licences. Paid or “free with restrictions” assets (CGTrader, Fab, MakerWorld, Unreal-only libraries) are out. Log every file in `CREDITS.md`.

| Asset | Source | Licence |
| --- | --- | --- |
| Stone, sand, grass textures | [Poly Haven](https://polyhaven.com), [ambientCG](https://ambientcg.com) | CC0 |
| Dawn sky HDRI | Poly Haven | CC0 |
| Trees and props | Poly Haven models, [Kenney](https://kenney.nl) | CC0 |
| Reference and in-card photos | [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Konark_Sun_Temple) | Per file: use only CC0, CC BY, CC BY-SA; credit each |
| Ambient sound | [Freesound](https://freesound.org) | Filter to CC0 (or CC BY with credit) |
| Music | Freesound, Free Music Archive, Wikimedia Commons | CC0 / CC BY only |
| Narration | [Piper TTS](https://github.com/rhasspy/piper) | MIT (check the chosen voice’s own licence) |
| Fonts | Google Fonts | SIL OFL |
| Optional generated mesh | [TRELLIS](https://github.com/microsoft/TRELLIS) | MIT (needs a GPU; optional) |

CC BY-SA images can be shown in cards with credit, but don’t bake them into textures unless the whole texture is shared under the same licence.

## Two-day build plan

Day 1 makes it walkable; Day 2 makes it beautiful and tells the story. Review in the browser at the end of each block before moving on.

**Day 1 — Walkable temple**

- [ ] Scaffold the app, engine folders and credits file; pin dependencies
- [ ] First-person controller with physics, collisions, desktop and mobile controls
- [ ] Ground, enclosure wall, east gate, coastal landscape and dawn sky
- [ ] Kit parts: plinth, wheel, pidha roof, amalaka, kalasha, pillars, stairs
- [ ] Assemble the block-out: nata mandir, chariot plinth with 24 wheels, horses, jagamohana, deul ruin, Mayadevi Temple
- [ ] Hotspot system reading `content.json`; all 10 stops placed with text

**Day 2 — Atmosphere and story**

- [ ] CC0 textures, normal maps, frieze decals; chlorite material for Surya images
- [ ] Lighting pass: sunrise, fog, bloom, ambient occlusion, trees, particles
- [ ] Hotspot cards with Odia titles, legend badge, images and credits
- [ ] Ambient audio, music and Piper narration for each stop
- [ ] Guided mode, intro screen, end screen with labelled reconstruction of the tower
- [ ] Performance pass and low-quality mode; test on a phone

**Definition of done**

- Walk from the east gate to the deul ruin without falling through anything.
- All 10 hotspots open with correct text; legends are labelled as legends.
- Runs at 60 fps on a mid-range laptop, 30 fps on a recent phone.
- Works with sound off; captions for all narration; keyboard accessible.
- `CREDITS.md` lists every asset with source and licence; no paid or restricted assets.
- A new site can be started by copying `src/sites/konark` and changing the scene and content.

## Starter prompt for Claude Code

Export this doc as Markdown, save it in the repo as `docs/BRIEF.md`, then paste the prompt below.

```markdown
Read docs/BRIEF.md fully. It is the spec for a browser-based, first-person, walkable
3D recreation of the Konark Sun Temple (Odisha, India), built procedurally in code,
with history hotspots, sound and narration.

Hard rules:
- Free and open source only. No paid assets, APIs, accounts or services.
- Install only from official npm/PyPI registries and official GitHub repos; pin versions;
  run npm audit; tell me before adding any dependency not listed in the brief.
- Record every asset with source and licence in CREDITS.md (CC0, CC BY, OFL, MIT only).
- Mark legends as legends; don't invent historical facts. If unsure, leave a TODO.

Start with Day 1 of the build plan:
1. Scaffold Vite + React + TypeScript with React Three Fiber, drei, rapier,
   postprocessing, GSAP, Howler, zod. Use the folder structure in the brief.
2. Build the first-person controller (desktop + mobile) with collisions.
3. Build the parametric kit parts, then assemble the Konark block-out using the site
   table's proportions (1 unit = 1 m, east-facing, entrance in the east).
4. Implement hotspots from src/sites/konark/content.json with all 10 stops from the brief.

After each step, run the dev server, check the scene in the browser, and give me a
short summary with a screenshot before continuing.
```

## Facts to verify

These are uncertain or disputed; check them against ASI material or a published history before launch.

- [ ] Jagamohana height: sources give about 30 m and about 39 m
- [ ] Wheel diameter: UNESCO says about 3 m; other sources say up to 3.7 m
- [ ] Number of horses: UNESCO’s short description says six, its detailed text says seven — the brief uses seven
- [ ] Exact positions and footprints of the nata mandir, Mayadevi Temple and enclosure gates (use a site plan or satellite view)
- [ ] When the deul tower fell (UNESCO: 19th century) and its original height (estimates 60–70 m)
- [ ] Sundial claim for the wheels and the three-Surya “morning, noon, evening” reading (keep labelled as tradition)
- [ ] Whether the sea is visible from the temple today
- [ ] Status of the sand removal from the jagamohana since 2022
- [ ] All Odia text, checked by a native speaker

## Sources

- [UNESCO — Sun Temple, Konârak](https://whc.unesco.org/en/list/246/)
- [Konark Sun Temple: a 13th-century Hindu temple in Odisha](https://www.ancient-history-sites.com/?p=133146)
- [Anantam IAS — Konark Sun Temple: architecture and significance](https://anantamias.com/konark-sun-temple/)
- [CivilsDaily — Konark Sun Temple (ASI sand removal)](https://www.civilsdaily.com/news/places-in-news-konark-sun-temple/)
- [MasterClass — Konark Sun Temple history and architecture](https://www.masterclass.com/articles/konark-sun-temple-history-and-architecture)
- [Wikimedia Commons — Konark Sun Temple category](https://commons.wikimedia.org/wiki/Category:Konark_Sun_Temple)
