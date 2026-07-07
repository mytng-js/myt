export type * from './typeUtils'
export * from './helpers'

export {
  // system

  // EffectScope
  type EffectScope,
  effectScope,
  getCurrentScope,
  onScopeDispose,

  // Effect
  type Effect,
  type EffectRunner,
  type EffectOptions,
  // base effect
  effect,
  renderEffect,

  // Signal
  type Signal,
  signal,
  isSignal,
  isSignals,

  // Computed
  type Computed,
  type WritableComputed,
  type ComputedGetter,
  type ComputedSetter,
  computed,
  isComputed,

  // Watch
  type WatchEffect,
  type WatchSource,
  type WatchCallback,
  type onCleanupFn,
  type WatchEffectOptions,
  type WatchOptions,
  type WatchHandle,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
  watch,
  onWatcherCleanup,
} from './signals'

export { nextTick } from './core'

export function defineTest() {
  if (__SSR__) {
    const fn = () => {
      // oxlint-disable-next-line no-console
      console.log('ssr')
    }
    fn.stop = fn
    // More code...
    return fn
  }

  const fn = () => {
    // oxlint-disable-next-line no-console
    console.log('client')
  }
  fn.stop = fn
  // More code...
  return fn
}
