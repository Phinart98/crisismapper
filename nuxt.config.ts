import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-05-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/i18n', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
  },
  app: {
    head: {
      title: 'CrisisMapper',
      meta: [
        { name: 'description', content: 'Report damage from any phone, anywhere — even without internet.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap'
        }
      ]
    }
  },
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    vueI18n: './i18n.config.ts',
    langDir: 'locales/',
    locales: [
      { code: 'en', file: 'en.json', dir: 'ltr' },
      { code: 'es', file: 'es.json', dir: 'ltr' },
      { code: 'fr', file: 'fr.json', dir: 'ltr' },
      { code: 'ar', file: 'ar.json', dir: 'rtl' },
      { code: 'ru', file: 'ru.json', dir: 'ltr' },
      { code: 'zh', file: 'zh.json', dir: 'ltr' },
    ],
  },
  runtimeConfig: {
    dbUrl: '',              // NUXT_DB_URL — Supavisor pooler, port 6543, ?prepareThreshold=0
    supabaseServiceKey: '', // NUXT_SUPABASE_SERVICE_KEY
    public: {
      supabaseUrl: '',      // NUXT_PUBLIC_SUPABASE_URL
      supabaseAnonKey: '',  // NUXT_PUBLIC_SUPABASE_ANON_KEY
      demoCrisisId: '',     // NUXT_PUBLIC_DEMO_CRISIS_ID — seeded Myanmar EQ 2026 UUID
    }
  },
  nitro: {
    preset: 'vercel'
  },
  pwa: {
    strategies: 'injectManifest',
    srcDir: 'service-worker',
    filename: 'sw.ts',
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    scope: '/',
    base: '/',
    manifest: {
      name: 'CrisisMapper',
      short_name: 'CrisisMapper',
      description: 'Report damage from any phone, anywhere — even without internet.',
      theme_color: '#0e1116',
      background_color: '#f4eee2',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    },
    devOptions: {
      enabled: true,
      type: 'module',
      suppressWarnings: true,
      navigateFallback: '/',
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600,
    },
  },
})
