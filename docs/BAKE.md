# Baked lighting (Konark)

The walk's sun shadows, sky light and ambient occlusion are rendered once, offline, in
three.js on the GPU, and stored in `public/sites/konark/bake/`. At runtime the browser only
reads them: no live shadow maps and no screen-space AO, so it runs on modest GPUs.

- **What is baked:** for every surface point, how much of the sun's disc it sees (48 samples:
  soft, accurate shadows) and how much sky and ground-bounce light reaches it (192 sky
  directions, each tested against the whole scene, trees included).
- **Where it goes:** flat surfaces get lightmap texels (`lm-*.webp` = sky light,
  `sun-*.webp` = sun visibility; 14 texels/m on stone, 5 on the ground). Dense carved shapes
  (wheels, statues) store light per vertex (`v-*.bin`).
- **Runtime:** materials keep the live sun (so carving normal maps still catch the light) but
  multiply it by the baked sun visibility, and take all ambient light from the bake. The sun
  is fixed at the baked position (azimuth 100°, elevation 26°: a clear October morning).
- **Layout:** lightmap UVs are generated deterministically by the scene builder
  (`src/kit/lightmap.ts`), so nothing extra ships. If the scene changes, the manifest no longer
  matches and the walk falls back to live lighting (with a console warning) until re-baked.

## Re-baking

With the dev server running, open `http://localhost:5199/?bake` in Chrome with GPU
acceleration and wait for "done" (about 30–60 s on an Apple M5). The bake leaves its files in
`window.__bake` (base64); the review script writes them into `public/sites/konark/bake/`.
Settings (sun angle, sample counts, sky and bounce strength) are in `src/bake/run.ts`.

## Sculpture

Statues and wall reliefs are sculpted procedurally (`src/kit/sculpt.ts`, `src/kit/statues.ts`):
signed-distance primitives blended smoothly and meshed with three's `MarchingCubes`. Each
unique statue is built once when the walk loads (≈0.1–0.5 s each) and placed many times;
their light is baked per vertex (welded meshes, 2 bytes per vertex). Preview them at
`/?sculpt=animals` and `/?sculpt=figures` in development.

Budget now: ~2.0M triangles of temple and sculpture, ~0.55M of trees (760 broadleaf, 140 casuarina, 50 palms, 1 banyan); bake 5.0 MB. Trees are occluders in the bake: re-bake after changing them.
