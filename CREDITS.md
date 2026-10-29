# Credits and licences

Every asset and dependency in this project, with its source and licence. Nothing is paid, and nothing needs an account or API key.

## Assets

The 3D world and its sound are generated in code at load time. The only third-party files are the photographs listed further down.

| What | How it's made | Licence |
| --- | --- | --- |
| Stone, laterite, chlorite, sand, grass, path textures and normal maps | Procedural noise in `src/engine/textures.ts` | This project |
| Entry hallway: sandstone, carved medallion panels, flagstones, vine-carved beam | Procedural, drawn in code in `src/entry/stone.ts` | This project |
| Frieze relief strip (dancers, musicians, lotus, vines, elephants) | Canvas drawing in `src/engine/textures.ts` | This project |
| Temple geometry (plinth, wheels, horses, pidha roof, amalaka, kalasha…) | Parametric kit in `src/kit/` | This project |
| Sea, wind, birds, footsteps, reverb, arrival bell | Web Audio synthesis in `src/engine/audio.ts` | This project |
| Music (drone, bamboo-flute line in raga Bhupali, mardala-style drum) | Generated in `src/engine/audio.ts` | This project |
| Narration (fallback) | The browser's own on-device speech voices, only where a recorded clip is missing | n/a (not shipped) |

### Mayadevi temple photos (story panel)

| File | Source | Author | Licence |
| --- | --- | --- | --- |
| `public/sites/konark/img/mayadevi-1.jpg` | [Mayadevi_Temple,_Kon%C3%A2rak_01.jpg](https://commons.wikimedia.org/wiki/File:Mayadevi_Temple,_Kon%C3%A2rak_01.jpg) | Bernard Gagnon | CC BY-SA 3.0 |
| `public/sites/konark/img/mayadevi-2.jpg` | [Mayadevi_Temple,_Kon%C3%A2rak_03.jpg](https://commons.wikimedia.org/wiki/File:Mayadevi_Temple,_Kon%C3%A2rak_03.jpg) | Bernard Gagnon | CC BY-SA 3.0 |
| `public/sites/konark/img/mayadevi-3.jpg` | [Mayadevi_Temple,_Kon%C3%A2rak_13_-_Crocodile.jpg](https://commons.wikimedia.org/wiki/File:Mayadevi_Temple,_Kon%C3%A2rak_13_-_Crocodile.jpg) | Bernard Gagnon | CC BY-SA 3.0 |

### Site photos on the India map (hover cards)

Resized to at most 900 px. Konark's card reuses its story photos above.

| File | Source | Author | Licence |
| --- | --- | --- | --- |
| `public/world/img/redfort-1.jpg` | [Lahori_Gate_(Red_Fort),_Delhi,_India_(2017).jpg](https://commons.wikimedia.org/wiki/File:Lahori_Gate_(Red_Fort),_Delhi,_India_(2017).jpg) | Lucky181993 | CC BY-SA 4.0 |
| `public/world/img/redfort-2.jpg` | [Lahori_Gate_-_Red_Fort_-_Delhi_2014-05-13_3151-3160_Compress.JPG](https://commons.wikimedia.org/wiki/File:Lahori_Gate_-_Red_Fort_-_Delhi_2014-05-13_3151-3160_Compress.JPG) | Biswarup Ganguly | CC BY 3.0 |
| `public/world/img/redfort-3.jpg` | [Red_Fort_-_Lahori_Gate_02.JPG](https://commons.wikimedia.org/wiki/File:Red_Fort_-_Lahori_Gate_02.JPG) | Vssun | CC BY-SA 3.0 |
| `public/world/img/taj-1.jpg` | [Taj_Mahal_in_March_2004.jpg](https://commons.wikimedia.org/wiki/File:Taj_Mahal_in_March_2004.jpg) | Dhirad, picture edited by J. A. Knudsen | CC BY-SA 3.0 |
| `public/world/img/taj-2.jpg` | [Aks_The_Reflection_Taj_Mahal.jpg](https://commons.wikimedia.org/wiki/File:Aks_The_Reflection_Taj_Mahal.jpg) | Antrix3 | CC BY-SA 4.0 |
| `public/world/img/taj-3.jpg` | [El_Taj_Mahal-Agra_India0023.JPG](https://commons.wikimedia.org/wiki/File:El_Taj_Mahal-Agra_India0023.JPG) | Diego Delso | CC BY-SA 4.0 |
| `public/world/img/hampi-1.jpg` | [Iconic_Stone_Chariot_@_Vittala_Temple,_Hampi,_Karnataka.jpg](https://commons.wikimedia.org/wiki/File:Iconic_Stone_Chariot_@_Vittala_Temple,_Hampi,_Karnataka.jpg) | Ram Nagesh Thota | CC BY-SA 4.0 |
| `public/world/img/hampi-2.jpg` | [Stone_Chariot,_Hampi_2.jpg](https://commons.wikimedia.org/wiki/File:Stone_Chariot,_Hampi_2.jpg) | Ajayreddykalavalli | CC BY-SA 4.0 |
| `public/world/img/hampi-3.jpg` | [Hampi,_Vittala_Temple,_chariot_(9881832023).jpg](https://commons.wikimedia.org/wiki/File:Hampi,_Vittala_Temple,_chariot_(9881832023).jpg) | Arian Zwegers from Brussels, Belgium | CC BY 2.0 |
| `public/world/img/karla-1.jpg` | [Grand_Chaitya_at_Karla_Caves_-_2025_-_19.jpg](https://commons.wikimedia.org/wiki/File:Grand_Chaitya_at_Karla_Caves_-_2025_-_19.jpg) | Oleg Yunakov | CC0 |
| `public/world/img/karla-2.jpg` | [Grand Chaitya at Karla Caves - 2025 - 10.jpg](https://commons.wikimedia.org/wiki/File:Grand_Chaitya_at_Karla_Caves_-_2025_-_10.jpg) | Oleg Yunakov | CC0 |
| `public/world/img/karla-3.jpg` | [Grand_Chaitya_at_Karla_Caves_-_2025_-_11.jpg](https://commons.wikimedia.org/wiki/File:Grand_Chaitya_at_Karla_Caves_-_2025_-_11.jpg) | Oleg Yunakov | CC0 |
| `public/world/img/khaj-1.jpg` | [Kandariya_Mahadeva_Temple,_Khajuraho,_Madhya_Pradesh,_India_002.jpg](https://commons.wikimedia.org/wiki/File:Kandariya_Mahadeva_Temple,_Khajuraho,_Madhya_Pradesh,_India_002.jpg) | WarmaFiesta | CC BY-SA 4.0 |
| `public/world/img/khaj-2.jpg` | [Kandariya_Mahadeva_Temple_at_Khajuraho,_Madhya_Pradesh,_India_0001_06.jpg](https://commons.wikimedia.org/wiki/File:Kandariya_Mahadeva_Temple_at_Khajuraho,_Madhya_Pradesh,_India_0001_06.jpg) | WarmaFiesta | CC BY-SA 4.0 |
| `public/world/img/khaj-3.jpg` | [Kandariya_Mahadeva_Temple_at_Khajuraho,_Madhya_Pradesh,_India_0001_02.jpg](https://commons.wikimedia.org/wiki/File:Kandariya_Mahadeva_Temple_at_Khajuraho,_Madhya_Pradesh,_India_0001_02.jpg) | WarmaFiesta | CC BY-SA 4.0 |
| `public/world/img/ajanta-1.jpg` | [Cave_26,_Ajanta.jpg](https://commons.wikimedia.org/wiki/File:Cave_26,_Ajanta.jpg) | Dey.sandip | CC BY-SA 3.0 |
| `public/world/img/ajanta-2.jpg` | [Ajanta_Caves_from_Cave_26.jpg](https://commons.wikimedia.org/wiki/File:Ajanta_Caves_from_Cave_26.jpg) | Shishirdasika | CC BY-SA 4.0 |
| `public/world/img/ajanta-3.jpg` | [Ajanta_cave_no._9_2010.jpg](https://commons.wikimedia.org/wiki/File:Ajanta_cave_no._9_2010.jpg) | Marcin Białek | CC BY-SA 4.0 |
| `public/world/img/ellora-1.jpg` | [Kailasa_Ellora.jpg](https://commons.wikimedia.org/wiki/File:Kailasa_Ellora.jpg) | Shishirdasika | CC BY-SA 4.0 |
| `public/world/img/ellora-2.jpg` | [Ellora_Cave_16_Kailasa_Temple.jpg](https://commons.wikimedia.org/wiki/File:Ellora_Cave_16_Kailasa_Temple.jpg) | Shishirdasika | CC BY-SA 4.0 |
| `public/world/img/ellora-3.jpg` | [Ellora_Caves,_India,_Kailasa_Temple.jpg](https://commons.wikimedia.org/wiki/File:Ellora_Caves,_India,_Kailasa_Temple.jpg) | Vyacheslav Argenberg | CC BY 4.0 |

### Music

| File | Source | Performer | Licence |
| --- | --- | --- | --- |
| `public/audio/dhaka-kevin-macleod.mp3` (level-matched, faded ends) | [Dhaka (ISRC USUAN1400003).mp3](https://commons.wikimedia.org/wiki/File:Dhaka_(ISRC_USUAN1400003).mp3), inspired by the sarod music of northern India; also at [incompetech.com](https://incompetech.com) | Kevin MacLeod | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) — credit line: "Dhaka" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 3.0 |

### Photographs (shown beside each story)

Real photographs from Wikimedia Commons, resized to at most 1400 px. Each is credited on screen with its author, licence and a link to its source page. Only CC BY, CC BY-SA and public-domain files are used. CC BY-SA files are shown as they are (resized) and are not baked into any texture.

| File | Source | Author | Licence |
| --- | --- | --- | --- |
| `public/sites/konark/img/arrival-1.jpg` | [Konark Sun Temple Puri district, Odisha, India 3.jpg](https://commons.wikimedia.org/wiki/File:Konark_Sun_Temple_Puri_district,_Odisha,_India_3.jpg) | Joydeep Chakraborty | CC BY-SA 4.0 |
| `public/sites/konark/img/arrival-2.jpg` | [Konark Sun Temple - North East Corner View.jpg](https://commons.wikimedia.org/wiki/File:Konark_Sun_Temple_-_North_East_Corner_View.jpg) | Bikashrd | CC BY-SA 4.0 |
| `public/sites/konark/img/gaja-1.jpg` | [Dance Pavilion, Konârak - Lions.jpg](https://commons.wikimedia.org/wiki/File:Dance_Pavilion,_Kon%C3%A2rak_-_Lions.jpg) | Bernard Gagnon | CC BY-SA 3.0 |
| `public/sites/konark/img/gaja-2.jpg` | [GajaNarasimha - Sun Temple Konark.jpg](https://commons.wikimedia.org/wiki/File:GajaNarasimha_-_Sun_Temple_Konark.jpg) | Bikashrd | CC BY-SA 4.0 |
| `public/sites/konark/img/nata-1.jpg` | [Konark Sun Temple - Natya Mandir.jpg](https://commons.wikimedia.org/wiki/File:Konark_Sun_Temple_-_Natya_Mandir.jpg) | Bikashrd | CC BY-SA 4.0 |
| `public/sites/konark/img/nata-2.jpg` | [Dance Pavilion, Konârak 01.jpg](https://commons.wikimedia.org/wiki/File:Dance_Pavilion,_Kon%C3%A2rak_01.jpg) | Bernard Gagnon | CC BY-SA 3.0 |
| `public/sites/konark/img/horse-1.jpg` | [Konark Sun Temple -Horse.jpg](https://commons.wikimedia.org/wiki/File:Konark_Sun_Temple_-Horse.jpg) | Vivek Bhavsar | CC BY-SA 4.0 |
| `public/sites/konark/img/horse-2.jpg` | [Konark horse.jpg](https://commons.wikimedia.org/wiki/File:Konark_horse.jpg) | Bharat Bhusan Sahoo | CC BY-SA 4.0 |
| `public/sites/konark/img/wheel-1.jpg` | [Chariot Wheel Konark Sun Temple.JPG](https://commons.wikimedia.org/wiki/File:Chariot_Wheel_Konark_Sun_Temple.JPG) | Alokprasad84 | CC BY 3.0 |
| `public/sites/konark/img/wheel-2.jpg` | [Konark Sun Temple wheel.jpg](https://commons.wikimedia.org/wiki/File:Konark_Sun_Temple_wheel.jpg) | Ankur Panchbudhe | CC BY 2.0 |
| `public/sites/konark/img/frieze-1.jpg` | [Some carvings on the wall of Konark.jpg](https://commons.wikimedia.org/wiki/File:Some_carvings_on_the_wall_of_Konark.jpg) | Bharat Bhusan Sahoo | CC BY-SA 4.0 |
| `public/sites/konark/img/frieze-2.jpg` | [Sculptures of musicians and dancers alongside mythical creatures, Mandapa, Sun Temple, Konark, Orissa.jpg](https://commons.wikimedia.org/wiki/File:Sculptures_of_musicians_and_dancers_alongside_mythical_creatures,_Mandapa,_Sun_Temple,_Konark,_Orissa.jpg) | SpeakingArch | CC BY-SA 4.0 |
| `public/sites/konark/img/jaga-1.jpg` | [Konark Sun Temple – Jagamohana, east view, Odisha.jpg](https://commons.wikimedia.org/wiki/File:Konark_Sun_Temple_%E2%80%93_Jagamohana,_east_view,_Odisha.jpg) | Reema Jalihal | CC BY-SA 4.0 |
| `public/sites/konark/img/jaga-2.jpg` | [NO-NB BLDSA GM2a133n.jpg](https://commons.wikimedia.org/wiki/File:NO-NB_BLDSA_GM2a133n.jpg) | Georg Morgenstierne | Public domain |
| `public/sites/konark/img/surya-1.jpg` | [Konark Sun Temple Statue of Sun God.jpg](https://commons.wikimedia.org/wiki/File:Konark_Sun_Temple_Statue_of_Sun_God.jpg) | Jayantanth | CC BY 3.0 |
| `public/sites/konark/img/surya-2.jpg` | [Konark ei2-26.jpg](https://commons.wikimedia.org/wiki/File:Konark_ei2-26.jpg) | G41rn8 | CC BY-SA 4.0 |
| `public/sites/konark/img/tower-1.jpg` | [Konark Temple painting 1848 Odisha in British Museum.png](https://commons.wikimedia.org/wiki/File:Konark_Temple_painting_1848_Odisha_in_British_Museum.png) | James Fergusson / Thomas Colman Dibdin | Public domain |
| `public/sites/konark/img/tower-2.jpg` | [Back Side View of Konark Sun Temple.jpg](https://commons.wikimedia.org/wiki/File:Back_Side_View_of_Konark_Sun_Temple.jpg) | Pawankumargurav | CC BY-SA 4.0 |
| `public/sites/konark/img/dharma-1.jpg` | [Konark palm leaf manuscript.jpg](https://commons.wikimedia.org/wiki/File:Konark_palm_leaf_manuscript.jpg) | Amshpatten | CC BY-SA 4.0 |

When further files are added (Poly Haven textures, Freesound ambience, Piper voice files), add a row for each.

### Map of India

| Data | Source | Licence |
| --- | --- | --- |
| India outline (land area of India per the official boundary of India, Survey of India) | [DataMeet `Country/india-composite.geojson`](https://github.com/datameet/maps/blob/master/Country/india-composite.geojson) | CC0 |
| State boundaries | [DataMeet `States/Admin2`](https://github.com/datameet/maps/tree/master/States) by the [DataMeet India community](http://datameet.org/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

| Rivers | [Natural Earth](https://www.naturalearthdata.com/) 10m rivers and lake centerlines | Public domain |
| India outline cross-check | Natural Earth 10m admin 0, India point-of-view (`ne_10m_admin_0_countries_ind`) | Public domain |

Converted and simplified by `tools/map/build_india.py` and `tools/map/build_extras.py` into `src/world/india-map.json` and `src/world/india-extras.json`. The DataMeet outline and Natural Earth's India point-of-view outline cover the same extent (bounds agree within 0.05°); they differ only in coastline detail.

### Narration and translation (generated ahead of time; nothing is called at runtime)

| What | Model / tool | Licence |
| --- | --- | --- |
| Hindi and Odia text | [Sarvam-Translate](https://huggingface.co/sarvamai/sarvam-translate) (`sarvam-translate:v1`), via the [Sarvam AI API](https://docs.sarvam.ai) on the owner's account, or run locally, by `tools/i18n/translate.py` | GPL-3.0 (open model); API use under Sarvam's terms of service |
| Narration audio (`public/sites/*/vo/`), English, Hindi, Odia | [Sarvam AI Bulbul v3](https://docs.sarvam.ai) text-to-speech, speaker recorded per clip in `vo/manifest.json` (`_voices`), generated by `tools/voice/sarvam_tts.py` on the owner's paid account | Sarvam AI terms of service — check commercial-use terms before public launch |
| (alternative, unused) | [AI4Bharat Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts), `tools/voice/generate.py` | Apache-2.0 |

Every machine translation still needs a native speaker's review.

### The story of Konark (paper-cut film)

Every scene, figure and paper surface is generated by our own scripts — `tools/blender/` for the
rendered film (`public/sites/konark/story/`), `src/journey/paper/` for the in-browser fallback. No
external images or models. Rendered with [Blender](https://www.blender.org) (GPL-3.0; a tool only —
the renders are ours) and encoded with [FFmpeg](https://ffmpeg.org) (LGPL/GPL; a tool only). Narration: Sarvam AI Bulbul (see above). Music: as listed above.

### Carved stone of the walk

`public/sites/konark/tex/` (frieze of dancers, musicians and elephants; weathered ashlar; dressed
stone): sculpted as height fields by our own script, `tools/blender/relief.py`, from rounded
primitives and generated noise. No photographs or scanned textures. Previewed in Blender (a tool
only) and encoded with [cwebp](https://developers.google.com/speed/webp) (BSD; a tool only).

### The chamber's stone tablet

`public/entry/slab-*` (the sandstone the India map and Konark's plan are cut into): one height field
the size of the slab, generated from noise by our own script, `tools/blender/entry_stone.py`. No
photographs. Encoded with cwebp.

The walk's light (`public/sites/konark/bake/`) is baked from our own scene by our own script,
`tools/blender/bake_light.py`, with Blender's Cycles renderer (a tool only).

## Fonts (loaded from Google Fonts)

| Font | Use | Licence |
| --- | --- | --- |
| Cormorant Garamond | Headings and display | SIL OFL 1.1 |
| DM Sans | All other text | SIL OFL 1.1 |

Hindi and Odia text uses the visitor's system fonts for those scripts.

## Runtime libraries (shipped in the bundle)

All from the official npm registry, versions pinned in `package.json`.

| Package | Version | Licence |
| --- | --- | --- |
| react, react-dom | 19.3.1 | MIT |
| three | 0.186.1 | MIT |
| @react-three/fiber | 9.8.1 | MIT |
| @react-three/drei | 10.7.9 | MIT |
| @react-three/rapier | 2.2.0 | MIT (per [repository](https://github.com/pmndrs/react-three-rapier); `license` field missing from its package.json) |
| @dimforge/rapier3d-compat | 0.19.2 | Apache-2.0 |
| @react-three/postprocessing | 3.2.0 | MIT |
| postprocessing | 6.39.5 | Zlib (permissive; not in the brief's list, flagged for approval) |
| n8ao (via postprocessing wrapper) | 2.0.1 | ISC (permissive; not in the brief's list, flagged for approval) |
| howler | 2.2.4 | MIT |
| zod | 4.6.7 | MIT |

## Development tools (not shipped)

| Package | Version | Licence |
| --- | --- | --- |
| agentation (UI feedback toolbar, loaded only in `npm run dev`) | 3.1.2 | PolyForm Shield 1.0.0 (source-available, not OSI open source; dev-only, excluded from builds) |

## Build tools (not shipped)

| Package | Version | Licence |
| --- | --- | --- |
| vite | 8.3.4 | MIT |
| @vitejs/plugin-react | 6.1.2 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| lightningcss (vite dependency) | 1.33.0 | MPL-2.0 |

## Deliberately not used

- **GSAP** was in the brief's stack, but its licence is GreenSock's own "Standard no-charge licence", not an open-source licence, so it fails the brief's open-licence rule. Camera glides use a small hand-written easing tween instead (`src/engine/Player.tsx`).

## Trees and grass

Leaf clusters, casuarina needles, coconut fronds, grass tufts and the lawn are modelled
procedurally and rendered in Blender (Cycles) by `tools/blender/foliage.py`, then converted with
`tools/blender/foliage_post.py` and cwebp. No photographs or downloaded assets.
