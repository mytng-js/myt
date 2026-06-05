import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const define: Record<string, any> = {}
const alias: Record<string, any> = {}

if (process.env.NODE_ENV === 'development') {
  Object.assign(define, {
    __DEV__: 'true',
    __SSR__: 'false',
    __TEST__: 'false',
    __E2E_TEST__: 'false',
    __VERSION__: `""`,
  })

  Object.assign(alias, {
    mytng: fileURLToPath(new URL(`../../packages/myt/src`, import.meta.url)),
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss()],
  define: {
    ...define,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...alias,
    },
  },
})
