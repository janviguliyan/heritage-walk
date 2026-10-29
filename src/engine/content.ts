import { z } from 'zod'

const Vec3 = z.tuple([z.number(), z.number(), z.number()])

/** Text in several languages; English is required. A plain string means English only. */
export type Loc = { en: string } & Record<string, string>
const L = z
  .union([z.string(), z.object({ en: z.string() }).catchall(z.string())])
  .transform((v): Loc => (typeof v === 'string' ? { en: v } : (v as Loc)))

/** Pick a language, falling back to English. */
export const tx = (text: Loc, lang: string) => text[lang] || text.en

/** A real photograph shown beside the story. Only CC0 / CC BY / CC BY-SA / public-domain files. */
const Photo = z.object({
  src: z.string(),
  caption: L,
  author: z.string(),
  licence: z.string(),
  licenceUrl: z.string().optional(),
  /** the file's page, e.g. on Wikimedia Commons */
  source: z.string(),
})

export const HotspotSchema = z.object({
  id: z.string(),
  /** where the glowing marker floats */
  position: Vec3,
  /** where a visitor stands (feet) and what they look at, for guided mode */
  view: z.object({ position: Vec3, lookAt: Vec3 }),
  /** waypoints (feet positions) walked through when gliding here from the previous stop */
  via: z.array(Vec3).default([]),
  title: L,
  body: L,
  legend: z.boolean().default(false),
  tradition: z.boolean().default(false),
  photos: z.array(Photo).default([]),
})

const StoryScene = z.object({
  /** illustration key, drawn by the site's story art */
  art: z.string(),
  text: L,
  legend: z.boolean().default(false),
})

export const SiteContentSchema = z.object({
  id: z.string(),
  name: L,
  tagline: L,
  intro: L,
  /** short prologue shown before the walk */
  story: z.array(StoryScene).default([]),
  start: z.object({ position: Vec3, lookAt: Vec3 }),
  /** the aerial map view: orbit around `target`, bearing in degrees clockwise from north */
  overview: z.object({ target: Vec3, bearing: z.number(), elevation: z.number(), distance: z.number() }),
  /** named places shown as labels on the map (not stops) */
  landmarks: z.array(z.object({ name: L, position: Vec3 })).default([]),
  hotspots: z.array(HotspotSchema).min(1),
  end: z.object({
    title: L,
    body: L,
    view: z.object({ position: Vec3, lookAt: Vec3 }),
  }),
  credits: z.array(z.object({ what: z.string(), source: z.string(), licence: z.string() })).default([]),
})

/** One language's translations, kept in its own file (content.<lang>.json). */
export const OverlaySchema = z.object({
  name: z.string().optional(),
  tagline: z.string().optional(),
  intro: z.string().optional(),
  story: z.array(z.string()).optional(),
  landmarks: z.array(z.string()).optional(),
  end: z.object({ title: z.string().optional(), body: z.string().optional() }).optional(),
  hotspots: z
    .record(z.string(), z.object({ title: z.string().optional(), body: z.string().optional(), photos: z.array(z.string()).optional() }))
    .optional(),
})

export type Hotspot = z.infer<typeof HotspotSchema>
export type Photo = z.infer<typeof Photo>
export type SiteContent = z.infer<typeof SiteContentSchema>
export type Overlay = z.infer<typeof OverlaySchema>

export function parseContent(raw: unknown, overlays: Record<string, unknown> = {}): SiteContent {
  const r = SiteContentSchema.safeParse(raw)
  if (!r.success) throw new Error('Invalid site content:\n' + z.prettifyError(r.error))
  const c = r.data
  for (const [lang, rawOverlay] of Object.entries(overlays)) {
    const o = OverlaySchema.safeParse(rawOverlay)
    if (!o.success) throw new Error(`Invalid ${lang} content:\n` + z.prettifyError(o.error))
    const v = o.data
    const put = (t: Loc, s?: string) => s && (t[lang] = s)
    put(c.name, v.name)
    put(c.tagline, v.tagline)
    put(c.intro, v.intro)
    v.story?.forEach((s, i) => c.story[i] && put(c.story[i].text, s))
    v.landmarks?.forEach((s, i) => c.landmarks[i] && put(c.landmarks[i].name, s))
    put(c.end.title, v.end?.title)
    put(c.end.body, v.end?.body)
    for (const h of c.hotspots) {
      const t = v.hotspots?.[h.id]
      if (!t) continue
      put(h.title, t.title)
      put(h.body, t.body)
      t.photos?.forEach((s, i) => h.photos[i] && put(h.photos[i].caption, s))
    }
  }
  return c
}
