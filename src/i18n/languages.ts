/**
 * Languages of the tour. `enabled` ones have translated text (and, where generated,
 * narration). The rest are India's other scheduled languages, ready to switch on as
 * translations are added — the pipeline (Sarvam-Translate + Indic Parler-TTS) covers them.
 */
export interface Language {
  code: string
  /** English name */
  name: string
  /** name in its own script */
  native: string
  /** BCP-47 tag for speech fallback */
  speech: string
  enabled: boolean
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English', speech: 'en-IN', enabled: true },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', speech: 'hi-IN', enabled: true },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', speech: 'or-IN', enabled: true },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', speech: 'as-IN', enabled: false },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', speech: 'bn-IN', enabled: false },
  { code: 'brx', name: 'Bodo', native: 'बड़ो', speech: 'brx-IN', enabled: false },
  { code: 'doi', name: 'Dogri', native: 'डोगरी', speech: 'doi-IN', enabled: false },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', speech: 'gu-IN', enabled: false },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', speech: 'kn-IN', enabled: false },
  { code: 'ks', name: 'Kashmiri', native: 'कॉशुर', speech: 'ks-IN', enabled: false },
  { code: 'kok', name: 'Konkani', native: 'कोंकणी', speech: 'kok-IN', enabled: false },
  { code: 'mai', name: 'Maithili', native: 'मैथिली', speech: 'mai-IN', enabled: false },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', speech: 'ml-IN', enabled: false },
  { code: 'mni', name: 'Manipuri', native: 'মৈতৈলোন্', speech: 'mni-IN', enabled: false },
  { code: 'mr', name: 'Marathi', native: 'मराठी', speech: 'mr-IN', enabled: false },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', speech: 'ne-IN', enabled: false },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', speech: 'pa-IN', enabled: false },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', speech: 'sa-IN', enabled: false },
  { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', speech: 'sat-IN', enabled: false },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي', speech: 'sd-IN', enabled: false },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', speech: 'ta-IN', enabled: false },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', speech: 'te-IN', enabled: false },
  { code: 'ur', name: 'Urdu', native: 'اردو', speech: 'ur-IN', enabled: false },
]

export const ENABLED = LANGUAGES.filter((l) => l.enabled)
export const languageOf = (code: string) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
