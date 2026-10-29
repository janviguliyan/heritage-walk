# Heritage Experience — Entry Flow Redesign Brief

Oct 16, 2026 · @Janvi

## What this brief is

The website already exists, but the experience and visual design are weak. This brief redesigns the **entry flow**, from the first screen to the start of the Konark walk, and raises the quality of the Konark 3D model. The walk inside Konark will be redesigned in a later brief.

**The flow at a glance**

1. **Hallway** — the visitor lands in a carved stone hallway. Scrolling moves them forward through it.
2. **Chamber** — after about two scrolls they enter an inner chamber, and the camera zooms onto a stone platform.
3. **India map** — the platform becomes an aged, hand-drawn map of India. Hovering a site shows a small card; clicking one zooms in.
4. **Story reel** — a 15-second folk-art animation introduces Konark. One action: Skip.
5. **Konark overview** — the 3D temple from a high three-quarter view. Spots can be hovered and clicked, with one “Start journey” button.

**How Claude Code should work**

- Read the whole brief and inspect the existing codebase before changing anything. Reuse what works; replace what doesn’t.
- Build one scene at a time. After each, run the site, take screenshots at desktop and phone sizes, compare them with the reference images, and fix what’s off before moving on.
- Hold the quality bar in the next section. “Working” is not done; it has to look crafted.
- Everything must stay free and open source: no paid assets, APIs or services. Log every asset and its licence in `CREDITS.md`.

## Visual direction

All five scenes must feel like one world: **warm, hand-carved sandstone lit by low, golden light, with deep shadow.** The visitor should feel they have stepped inside an ancient Indian temple, not opened a website.

**Take from the references**

- **Material:** honey-to-rust sandstone with visible grain, weathering and worn edges (hallway, chamber). Aged parchment with burnt, torn edges (map).
- **Light:** one strong warm light source, raking across carvings so every relief reads; soft falloff into near-black. A thin shaft of daylight from above in the chamber.
- **Motifs:** lotus medallions in square panels, stacked pillar mouldings, scrolling vines, a circular seal emblem (map corner), chariot-wheel spokes for Konark. Use these for frames, dividers, loaders, cursors and hotspot markers.
- **Palette:** sandstone `#C8955A`, ochre `#A86A2E`, rust `#7A3E1C`, parchment `#E9D2A6`, ink `#3A2412`, shadow `#140C06`, accent sun-gold `#E8B04A`. Tune by eye against the images.

**Typography**

- Display: a carved or calligraphic serif with an Indian feel, such as *Tiro Devanagari Latin*, *Rozha One* or *Yatra One*. Body: a warm, readable serif or *Noto Sans*. Local scripts (Odia, Devanagari) via Noto. All from Google Fonts (OFL).
- Map labels in a hand-lettered style, like the reference.

**Quality bar — the current site falls short of this**

- No flat UI over the 3D. Cards, buttons and labels are stone, parchment or carved bronze, with texture, edge highlights and soft shadows.
- Every transition is continuous camera movement. No hard cuts, no blank loading screens: loaders use the wheel or lotus motif.
- Use film-like post-processing: tone mapping, gentle bloom on light, ambient occlusion, vignette and fine grain.
- Layer in ambient sound: footsteps on stone, a soft drone, distant birds. Off until the first interaction, with a mute toggle.
- Respect `prefers-reduced-motion` with a calmer fallback.

## Scene 1 — The hallway

The visitor lands at the mouth of a long, carved pillared corridor, matching Reference 1. Scrolling doesn’t move the page; it moves the visitor forward through the hall.

&#91;image: Reference 1 — the hallway\]

**Build it**

- A real 3D corridor, not a flat image: two rows of square pillars with stacked mouldings and lotus medallion panels, a flat slab ceiling, worn flagstone floor, and an open side letting warm light fall across the pillars.
- Use instanced pillars with sandstone textures, normal maps for the carvings, and ambient occlusion so the panels read.
- Strong one-point perspective down the hall, with the far end dark and inviting.

**On landing**

- The title fades in carved into the stone or floating low in warm light, with one line: *“Every stone here remembers a story.”* (Placeholder copy.)
- A small hint: a scroll or swipe glyph made of the lotus motif, softly pulsing.
- Subtle life: dust in the light shafts, a slow camera sway.

**Scroll behaviour**

- Scroll, trackpad, swipe and arrow keys all drive a camera along a spline down the corridor.
- About **two scroll gestures** carry the visitor to the end of the hall and through a doorway into Scene 2.
- Motion is smoothed (eased with inertia), never jerky. Scrolling back reverses it.
- Footstep sounds sync with movement.

## Scene 2 — The inner chamber

At the end of the hallway the visitor steps through a heavy stone doorway into a small, dim chamber like Reference 2: massive dressed blocks, a carved guardian figure on one wall, and a single thin shaft of light falling from above.

&#91;image: Reference 2 — the chamber\]

**Build it**

- Large, slightly uneven stone blocks with deep joints, a stepped doorway frame, a recessed niche, and a carved relief figure in the style of the reference. Keep the figure generic, not a specific deity.
- A low stone platform at the centre, lit by the shaft of light. It’s where the map will appear.
- Lighting is darker and more intimate than the hallway: one top light, warm bounce, deep shadow, floating dust.

**The zoom**

- Once inside, the camera drifts toward the platform and tilts down until the platform fills the screen. This continues the same scroll; no separate click.
- As it settles, the platform’s surface glows and the map unrolls or rises out of the stone, cross-fading smoothly into Scene 3.
- A soft sound cue (a low bell or a tanpura swell) marks the arrival.

## Scene 3 — The India map

The platform becomes an aged, hand-drawn map of India in the style of Reference 3: parchment, burnt torn edges, inked rivers and mountain hatching, and a carved circular seal in one corner. Sites are glowing markers the visitor can explore.

&#91;image: Reference 3 — map style only\]

**The map must be correct**

- Reference 3 is for **style only**. Its outline and labels are a historical fantasy map and must not be copied.
- Draw India’s outline from the official Survey of India boundaries, including the whole of Jammu & Kashmir and Ladakh. A free source that follows India’s view is Natural Earth’s **“India point-of-view”** admin boundaries (public domain). Verify against the official Survey of India political map.
- Add only light, real geography: major rivers (Ganga, Yamuna, Brahmaputra, Godavari, Krishna, Kaveri, Mahanadi, Narmada), the Himalaya and Western and Eastern Ghats as hatching, and the coastlines. No state borders unless they help.
- Render it as a textured surface on the platform in 3D, or as a high-quality SVG over a 3D parchment plane. Edges should look burnt and curled, with ink that slightly bleeds.

**Site markers**

- Each site is a small glowing motif (a lotus, or a wheel for Konark) that breathes gently. Live sites glow gold; upcoming sites are dimmer, inked outlines marked “Coming soon”.
- Start with **Konark (live)**. Add a few upcoming markers, such as Red Fort, Taj Mahal, Hampi, Karla Caves, Khajuraho and Ajanta–Ellora, so the map feels full.

**Hover card (like Airbnb’s map pins)**

- Hovering a marker raises a small card styled as parchment or carved stone: site name in English and local script, state, one-line hook, and an image strip.
- With 2–3 images, they auto-advance every \~1.5 s while hovered and stop when the pointer leaves. Use only CC0 or CC BY images, credited.
- The card never covers the marker; it flips position near screen edges. On touch, the first tap opens the card and the second tap enters.

**Click**

- Clicking a live site zooms smoothly into its spot on the map. The parchment dissolves into the Konark story reel (Scene 4), or straight into Scene 5 if the reel is skipped or not built.
- Keyboard: Tab moves between markers, Enter opens, Esc goes back.

## Scene 4 — The Konark story video

After choosing Konark, the visitor watches a short animated story, at most **15 seconds**, telling what Konark is in the spirit of the TV series *Krish, Trish and Baltiboy*, where stories were told through living folk art.

&#91;image: Reference 4 — animation style\]

**Style, not characters**

- Borrow the *approach*: flat, hand-painted folk-art figures with bold outlines, moving like paper cut-outs against painted backgrounds. **Do not reproduce the show’s characters** (the boy, the cat, the monkey, the donkey) or its artwork; they are copyrighted.
- For Konark, use **Odisha Pattachitra** as the art style: the region’s own scroll painting. Red, yellow, indigo and white, decorative borders, stylised figures and floral fills.

**Story beats (about 15 s)**

1. A Pattachitra border unrolls; Surya rides his chariot across the sky, pulled by seven horses (0–4 s).
2. King Narasimha Deva I commands a temple built as that chariot, by the sea (4–8 s).
3. Artisans carve; 24 wheels turn into stone (8–12 s).
4. The painted temple dissolves into the 3D Konark overview (12–15 s).

Narration: one sentence per beat, voiced by the AI guide, with captions. Soft music on pakhawaj and flute.

**Controls and behaviour**

- Only one control: **Skip**, low in a corner, styled to match.
- When it ends or is skipped, it flows straight into Scene 5. Play it once per session; after that, go straight to Scene 5.

**How to make it (all free)**

- Preferred: build it in code as a layered 2D animation. Draw SVG cut-out figures and backgrounds in Pattachitra style, animate with GSAP (or Lottie via the open-source lottie-web), with a little parallax and paper texture.
- Images can also come from public-domain or CC-licensed Pattachitra paintings (Wikimedia Commons), animated as layers, with credit.
- **If quality can’t meet the bar, skip this scene for now** and go from Scene 3 straight to Scene 5. Leave a placeholder hook to add it later. A clumsy reel is worse than none.

## Scene 5 — Konark overview

The visitor arrives above the 3D Konark temple (the model Claude Code built, not the paper map), seen from a high three-quarter angle, like a drone at sunrise. From here they can pick a spot or begin the journey.

**Layout**

- The 3D temple fills the screen, lit by low morning sun from the east, with gentle mist and a slow orbit drift.
- A small parchment panel to one side: site name, one-line summary, the number of story stops, and approximate walk time.
- **One primary button: “Start journey”** — carved bronze or stone, sun-gold glow. It starts the guided walk at the east entrance.
- A small “Back to map” control, styled quietly.

**Spots on the model**

- Each story stop from the Konark brief (gate, guardians, nata mandir, horses, wheel, friezes, jagamohana, Surya images, fallen tower) shows a small turning wheel marker.
- Hovering a marker highlights that part of the temple (a soft rim glow) and shows a mini card: name plus one line.
- Clicking flies the camera down to that spot and drops the visitor into the walk at that stop.
- Visitors can drag to orbit and scroll to zoom, within limits so they never lose the temple.

## Konark model upgrade

The current model doesn’t look like Konark. The goal is that anyone who has visited recognises it instantly: **the silhouette, proportions, every major element and the pattern of carving should match the real temple.** Every individual carved figure can’t be copied exactly, but the overall impression should come as close to the real thing as possible.

**Work from real references first**

- Collect 30–50 openly licensed photos from Wikimedia Commons (Konark category): all four sides, each wheel type, horses, gaja-simha, roof tiers, plinth friezes, Surya images, and an aerial view or site plan.
- Build a side-by-side check: the same camera angle in the model and in a reference photo. Iterate until they line up.

**What must be right**

- **Jagamohana:** square base, tall walls with vertical offsets, a three-tier stepped (pidha) pyramid roof separated by recessed bands lined with sculpted figures, topped by a large ribbed amalaka and a kalasha.
- **Chariot plinth:** high and richly moulded, with 12 wheels on each side, set into the plinth wall, not floating.
- **Wheels:** about 3 m across with 8 thick and 8 thin spokes, a carved hub, medallions on the thick spokes, and a decorated rim with an axle boss.
- **Horses:** at the east front, harnessed, pulling, partly broken where the real ones are.
- **Gaja-simha:** a lion rearing over an elephant that crushes a man, on a plinth either side of the east steps.
- **Nata mandir:** a high platform with carved pillars and walls and no roof.
- **Deul ruin and Surya images:** the surviving base and three green chlorite Surya figures in niches.
- **Surfaces:** dense horizontal bands of carving — figures, animals, scrolling vines — and weathered, salt-eroded stone where the real temple is worn.

**How to get the detail (free tools)**

- Model hero parts in **Blender** (free, GPL), scripted with Python where it helps; export as glTF and compress with gltf-transform and Draco or meshopt.
- Make carving detail from openly licensed photos: generate normal, height and ambient occlusion maps (e.g. with Materialize or Blender bake), and apply them as tiling bands and decals along friezes.
- Optional, needs a GPU: image-to-3D (TRELLIS, MIT) or open photogrammetry (COLMAP, Meshroom) from Commons photos for one wheel, one horse and the gaja-simha. Then clean and decimate them in Blender.
- Keep it fast: detailed meshes for close-up stops, simpler versions at a distance (LODs), and instanced wheels with per-wheel decal variation.

## Tools, performance and done

Keep the existing stack where it serves. Claude Code may add or switch to any **free, open-source** tool that gets a better result, and may install open-source Claude Code skills or plugins that help (for example 3D, animation or design skills), as long as each comes from an official registry or repo, has its version pinned, and is mentioned before it’s added.

| Need | Suggested tools |
| --- | --- |
| 3D scenes and transitions | three.js / React Three Fiber, drei, postprocessing |
| Scroll-driven camera | GSAP ScrollTrigger, or Lenis smooth scroll + a camera spline |
| Map | Natural Earth (India point-of-view boundaries), d3-geo to SVG, applied to a 3D parchment plane |
| 2D story reel | SVG + GSAP, or lottie-web |
| Modelling and textures | Blender, gltf-transform; Poly Haven and ambientCG (CC0) |
| Sound | Howler.js; Freesound (CC0 / CC BY) |
| AI voice | Open-source TTS (Piper or Kokoro), with captions |

**Performance**

- First scene visible in under 3 s on a good connection, with a motif-styled loader; later scenes stream while the visitor is in the hallway.
- 60 fps on a mid-range laptop, 30 fps on a recent phone. A lower-quality mode switches on automatically on weak devices.

**Definition of done**

- [ ] The flow runs end to end: hallway → chamber → map → (reel) → Konark overview → Start journey.
- [ ] Each scene matches its reference in mood, material and light; screenshots compared side by side.
- [ ] The India map uses official boundaries; hover cards and click-to-zoom work with mouse, touch and keyboard.
- [ ] The reel is either polished and under 15 s with Skip, or cleanly left out behind a hook.
- [ ] The Konark model is recognisable against reference photos from at least four angles.
- [ ] Works on desktop and phone, respects reduced motion, has a mute toggle and captions.
- [ ] `CREDITS.md` lists every asset and licence; nothing paid or restricted.

## Prompt for Claude Code

Export this doc as Markdown into the repo as `docs/ENTRY_FLOW.md`, and save the four reference images in `docs/refs/` as `1-hallway.png`, `2-chamber.png`, `3-map.png` and `4-animation-style.png`. Then paste:

```markdown
Read docs/ENTRY_FLOW.md and look at every image in docs/refs/ before writing code.
Then read the existing codebase and tell me in a few lines what you'll keep and replace.

Goal: rebuild the entry flow (hallway -> chamber -> India map -> Konark story reel ->
Konark overview) and upgrade the Konark 3D model, to a much higher visual standard than
the current site. The references set the mood, materials, lighting and motifs. Treat
3-map.png as style only: the India outline must follow official Survey of India boundaries.
Treat 4-animation-style.png as style only: do not reproduce its characters.

Rules:
- Free and open source only. Official registries and repos, pinned versions, npm audit.
  Tell me before adding a new dependency, skill or plugin.
- Log every asset with source and licence in CREDITS.md.
- Build one scene at a time. After each one, run the site, take desktop and phone
  screenshots, compare them with the matching reference, fix what's off, then show me
  the screenshots and a short summary before continuing.
- If the story reel can't reach the quality bar, leave it out behind a hook and tell me.

Start with Scene 1 (hallway) and the scroll-driven camera.
```
