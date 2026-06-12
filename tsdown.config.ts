import path from 'node:path'
import { createRequire } from 'node:module'
import { globSync } from 'tinyglobby'
import { type UserConfig, defineConfig } from 'tsdown'

const require = createRequire(import.meta.url)

const browserDirs: `${string}/${string}`[] = ['myt/src']

export default defineConfig(
  (() => {
    const resConfigs: UserConfig[] = []

    const pkgEntrys: Record<string, EntryItem[]> = {}

    // packages/<pkg>/*/index.ts
    globSync('packages/*/*/index.ts', {
      // Ignore some directories, including the Rust language.
      ignore: ['**/{__tests__,dist,node_modules,types,target,debug}/**', '**/_*/**', '**/.*/**'],
    }).forEach(entryFile => {
      // packages/myt/client/index.ts => dist/client.js
      // packages/myt/server/index.ts => dist/server.js
      // packages/myt/src/index.ts => server: dist/myt.js, client: dist/myt-browser.js
      // packages/myt/*/index.ts => server: dist/*.js, client: dist/*-browser.js
      const [_, pkgDir, subDir] = entryFile.split('/') as ['packages', PkgDir, SubDir]

      if (subDir === pkgDir) return

      const serverEntry = subDir === 'server'
      const clientEntry = subDir === 'client'

      let items = pkgEntrys[pkgDir]
      if (!items) items = pkgEntrys[pkgDir] = []

      items.push({
        // src/index.ts
        entryFile: entryFile.replace(`packages/${pkgDir}/`, ''),
        pkgDir,
        subDir,
        hasServer: !(serverEntry || clientEntry) && browserDirs.includes(`${pkgDir}/${subDir}`),
        onlyServerEntry: serverEntry,
        onlyClientEntry: clientEntry,
      })
    })

    for (const [pkgDir, items] of Object.entries(pkgEntrys)) {
      getUserConfig(resConfigs, pkgDir, items)
    }

    return resConfigs
  })(),
)

type PkgDir = 'myt' | (string & {})

type SubDir = 'client' | 'server' | 'src' | (string & {})

interface EntryItem {
  entryFile: string
  pkgDir: PkgDir
  subDir: SubDir
  hasServer: boolean
  onlyServerEntry: boolean
  onlyClientEntry: boolean
}

function getUserConfig(list: UserConfig[], pkgDir: PkgDir, items: EntryItem[]) {
  const pkgJSON = require(`./packages/${pkgDir}/package.json`) as {
    name: string
    version: string
  }

  const define = {
    __VERSION__: `"${pkgJSON.version}"`,
    __DEV__: `(process.env.NODE_ENV !== 'production')`,
    __TEST__: 'false',
    __E2E_TEST__: 'false',
    __SSR__: 'false',
  }

  const baseConfig: UserConfig = {
    cwd: path.resolve(process.cwd(), `./packages/${pkgDir}`),
    outDir: `dist`,
    target: ['es2016', 'node18'],
    // format: ['esm', 'cjs'],
    dts: { sourcemap: false },
    sourcemap: false,
    fixedExtension: false,
  }

  const clientEntry: Record<string, string> = {}
  const serverEntry: Record<string, string> = {}

  let hasClientEntry = false
  let hasServerEntry = false

  items.forEach(item => {
    const entry = item.entryFile
    const subDir = item.subDir === 'src' ? item.pkgDir : item.subDir

    if (item.hasServer) {
      serverEntry[subDir] = entry
      clientEntry[`${subDir}-browser`] = entry
      hasClientEntry = hasServerEntry = true
    } else if (item.onlyClientEntry) {
      clientEntry[subDir] = entry
      hasClientEntry = true
    } else {
      serverEntry[subDir] = entry
      hasServerEntry = true
    }
  })

  // ### clientConfig:
  // dist/client.js
  // dist/*.js => dist/*-browser.js
  if (hasClientEntry) {
    list.push({
      ...baseConfig,
      entry: clientEntry,
      define: { ...define },
      platform: 'browser',
    })
  }

  // ### serverConfig:
  // dist/server.js
  // dist/*.js
  if (hasServerEntry) {
    list.push({
      ...baseConfig,
      entry: serverEntry,
      define: { ...define, __SSR__: 'true' },
      platform: 'node',
    })
  }
}
