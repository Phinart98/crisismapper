// Open Location Code shape. 4-8 chars before '+' covers short and full codes.
// The composable + webhook each handle the pluscodes CJS interop differently
// (Vite namespace-import vs Nitro default-import-destructure) but share this regex.
export const PLUSCODE_RE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i
