import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-05-01',
  devtools: { enabled: true },
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
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap'
        }
      ]
    }
  },
  runtimeConfig: {
    dbUrl: '',              // DB_URL env — Supavisor pooler, port 6543, ?prepareThreshold=0
    supabaseServiceKey: '', // SUPABASE_SERVICE_KEY env
    public: {
      supabaseUrl: '',      // SUPABASE_URL env
      supabaseAnonKey: ''   // SUPABASE_ANON_KEY env
    }
  },
  nitro: {
    preset: 'vercel'
  }
})
