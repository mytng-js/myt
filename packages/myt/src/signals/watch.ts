import { EMPTY_OBJECT, NOOP, isArray, isEqual, isFunction } from '../helpers'
import { type SchedulerJob, SchedulerJobFlags, queueJob, queuePostFlushJob } from '../core'
import { ReactiveFlags } from './constants'
import { setActiveSub } from './system'
import { _cleanup } from './scope'
import { Effect } from './effect'
import type { Signal } from './signal'
import type { Computed } from './computed'
import { isSignals, traverse } from './utils'

export type WatchEffect = (onCleanup: onCleanupFn) => void

export type WatchSource<T = unknown> = Signal<T> | Computed<T> | (() => T)

export type WatchCallback<V = any, O = any> = (
  value: V,
  oldValue: O,
  onCleanup: onCleanupFn,
) => void | VoidFunction

export type onCleanupFn = (fn: VoidFunction) => void

type WatchFlush = 'pre' | 'post' | 'sync'

export interface WatchEffectOptions {
  /**
   * @default 'pre'
   */
  flush?: WatchFlush
}

export interface WatchOptions<I extends boolean = boolean> extends WatchEffectOptions {
  /**
   * @default false
   */
  immediate?: I
  /**
   * @default false
   */
  once?: boolean
  /**
   * @default false
   */
  deep?: boolean | number
}

export type WatchHandle = {
  (): void
  pause: VoidFunction
  resume: VoidFunction
  stop: VoidFunction
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

let activeWatcher: WatcherEffect | undefined

/**
 * Returns the current active effect if there is one.
 */
export function getCurrentWatcher(): WatcherEffect | undefined {
  return activeWatcher
}

export function watchEffect(fn: WatchEffect, options?: WatchEffectOptions): WatchHandle {
  return doWatch(fn, null, options)
}

export function watchPostEffect(fn: WatchEffect): WatchHandle {
  return doWatch(fn, null, { flush: 'post' })
}

export function watchSyncEffect(fn: WatchEffect): WatchHandle {
  return doWatch(fn, null, { flush: 'sync' })
}

export type MultiWatchSources = (WatchSource<unknown> | object)[]

type MaybeUndefined<T, I> = I extends true ? T | undefined : T

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? MaybeUndefined<V, Immediate>
    : T[K] extends object
      ? MaybeUndefined<T[K], Immediate>
      : never
}

// overload: single source + cb
export function watch<T, Immediate extends boolean = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle
// overload: reactive array or tuple of multiple sources + cb
export function watch<T extends Readonly<MultiWatchSources>, Immediate extends boolean = false>(
  sources: readonly [...T] | T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle
// overload: array of multiple sources + cb
export function watch<T extends MultiWatchSources, Immediate extends boolean = false>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle
// overload: watching reactive object w/ cb
export function watch<T extends object, Immediate extends boolean = false>(
  source: T,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle
//
export function watch<T = any, Immediate extends boolean = false>(
  source: T | WatchSource<T>,
  cb: WatchCallback,
  options?: WatchOptions<Immediate>,
): WatchHandle {
  return doWatch(source as any, cb, options)
}

/**
 * Registers a cleanup callback on the current active effect. This
 * registered cleanup callback will be invoked right before the
 * associated effect re-runs.
 *
 * @param fn - The callback function to attach to the effect's cleanup.
 * @param noWarn - if `true`, will not throw warning when called without
 * an active effect.
 * @param owner - The effect that this cleanup function should be attached to.
 * By default, the current active effect.
 */
export function onWatcherCleanup(fn: VoidFunction, noWarn?: boolean, owner = activeWatcher) {
  // SSR skips
  if (__SSR__) return

  if (owner) {
    owner._cleanups[owner._cleanupsLen++] = fn
  } else if (__DEV__ && !noWarn) {
    console.warn(
      `[Mytng warn]: onWatcherCleanup() was called when there was no active watcher  to associate with.`,
    )
  }
}

class WatcherEffect extends Effect<any> {
  forceTrigger: boolean
  isMultiSource: boolean
  old: any
  job: SchedulerJob

  cb?: WatchCallback<any, any> | null | undefined
  opts: WatchOptions

  _cln: (fn: VoidFunction) => void = fn => onWatcherCleanup(fn, false, this)

  constructor(
    source: WatchSource | WatchSource[] | WatchEffect | object,
    cb: WatchCallback<any, any> | null | undefined,
    opts: WatchOptions,
  ) {
    const { deep, once } = opts

    let getter: () => any
    let forceTrigger = false
    let isMultiSource = false

    if (isSignals(source)) {
      getter = source
      // forceTrigger = false
    } else if (isArray(source)) {
      isMultiSource = true
      // forceTrigger = source.some(s => )
      getter = () =>
        source.map(s => {
          if (isSignals(s)) {
            return s()
          } else if (isFunction(s)) {
            return s()
          } else if (__DEV__) {
            console.warn(`[Mytng warn]: Invalid watch source => `, s)
          }
        })
    } else if (isFunction(source)) {
      if (cb) {
        // getter with cb
        getter = source as () => any
      } else {
        // no cb -> simple effect
        getter = () => {
          if (this._cleanupsLen) {
            const prevSub = setActiveSub()
            try {
              _cleanup(this)
            } finally {
              setActiveSub(prevSub)
            }
          }
          const currentEffect = activeWatcher
          activeWatcher = this
          try {
            return source(this._cln)
          } finally {
            activeWatcher = currentEffect
          }
        }
      }
    } else {
      getter = NOOP
      if (__DEV__) {
        console.warn(`[Mytng warn]: Invalid watch source => `, source)
      }
    }

    if (cb && deep) {
      const baseGetter = getter
      const depth = deep === true ? undefined : deep
      getter = () => traverse(baseGetter(), depth)
    }

    super(getter)
    this.forceTrigger = forceTrigger
    this.isMultiSource = isMultiSource
    this.opts = opts

    if (once && cb) {
      const _cb = cb
      cb = (...args) => {
        const res = _cb(...args)
        this.stop()
        return res
      }
    }

    this.cb = cb
    this.old = isMultiSource
      ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
      : INITIAL_WATCHER_VALUE

    // job
    const job: SchedulerJob = () => {
      if (this.dirty) this.run()
    }

    if (cb) {
      this._flags |= ReactiveFlags.EffectAllowRecurse
      job.flags! |= SchedulerJobFlags.AllowRecurse
    }
    this.job = job
  }

  run(initialRun?: boolean): void {
    const oldValue = this.old
    const newValue = (this.old = super.run())
    if (!this.cb) return

    const { immediate, deep } = this.opts
    if (initialRun && !immediate) return

    if (
      initialRun ||
      deep ||
      this.forceTrigger ||
      (this.isMultiSource
        ? (newValue as any[]).some((v, i) => !isEqual(v, oldValue[i]))
        : !isEqual(newValue, oldValue))
    ) {
      // cleanup before running cb again
      _cleanup(this)
      const currentWatcher = activeWatcher
      activeWatcher = this
      try {
        this.cb(
          newValue,
          // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE
            ? undefined
            : this.isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE
              ? []
              : oldValue,
          this._cln,
        )
      } finally {
        activeWatcher = currentWatcher
      }
    }
  }

  notify() {
    const flags = this._flags
    if (!(flags & ReactiveFlags.EffectPaused)) {
      const { opts, job } = this
      if (opts.flush === 'post') {
        queuePostFlushJob(job)
      } else if (opts.flush === 'sync') {
        job()
      } else {
        // default: pre
        queueJob(job, this.s ? this.s.uid : undefined, true)
      }
    }
  }
}

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  options: WatchOptions = EMPTY_OBJECT,
): WatchHandle {
  // SSR skips
  if (__SSR__) {
    const noWatch = (() => {}) as WatchHandle
    noWatch.pause = noWatch
    noWatch.resume = noWatch
    noWatch.stop = noWatch
    return noWatch
  }

  const effect = new WatcherEffect(source, cb, options)

  // initial run
  if (cb) {
    effect.run(true)
  } else if (options.flush === 'post') {
    queuePostFlushJob(effect.job)
  } else {
    effect.run(true)
  }

  const stop = effect.stop.bind(effect) as WatchHandle
  stop.pause = effect.pause.bind(effect)
  stop.resume = effect.resume.bind(effect)
  stop.stop = stop
  return stop
}
