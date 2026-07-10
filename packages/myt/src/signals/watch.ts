import { EMPTY_OBJECT, NOOP, isArray, isEqual, isFunction } from '../helpers'
import { type SchedulerJob, SchedulerJobFlags, queueJob, queuePostFlushJob } from '../browser'
import { ReactiveFlags } from './constants'
import { _cleanup } from './scope'
import { Effect } from './effect'
import type { Signal } from './signal'
import type { ComputedLike } from './computed'

export type WatchSource<T = unknown> = Signal<T> | ComputedLike<T> | (() => T)

export type MultiWatchSources = (WatchSource<unknown> | object)[]

export type WatchCallback<V = any, O = any> = (value: V, oldValue: O, onCleanup: CleanupFn) => void

export type CleanupFn = (fn: VoidFunction) => void

export interface WatchOptions<I extends boolean = boolean> {
  /**
   * @default 'pre'
   */
  flush?: 'pre' | 'post' | 'sync'
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
  deep?: boolean
}

export type WatchHandle = {
  (): void
  pause: VoidFunction
  resume: VoidFunction
  stop: VoidFunction
}

type MaybeUndefined<T, I> = I extends true ? T | undefined : T

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? MaybeUndefined<V, Immediate>
    : T[K] extends object
      ? MaybeUndefined<T[K], Immediate>
      : never
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

class WatcherEffect extends Effect<any> {
  multiSrc: boolean
  old: any
  job: SchedulerJob

  cb: WatchCallback<any, any>
  opts: WatchOptions

  // onCleanup
  _cln: CleanupFn = fn => {
    this._cleanups[this._cleanupsLen++] = fn
  }

  constructor(
    source: WatchSource | WatchSource[] | object,
    cb: WatchCallback<any, any>,
    opts: WatchOptions,
  ) {
    let getter: () => any
    let multiSrc = false

    if (isFunction(source)) {
      // getter with: Signal, Computed, Fn
      getter = source as () => any
    } else if (isArray(source)) {
      getter = () => source.map(s => (isFunction(s) ? s() : s))
      multiSrc = true
    } else {
      getter = NOOP
      if (__DEV__) {
        console.warn(`Invalid watch source => `, source)
      }
    }

    super(getter)
    this.multiSrc = multiSrc
    this.opts = opts
    this.cb = cb || NOOP
    this.old = multiSrc
      ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
      : INITIAL_WATCHER_VALUE

    // job
    const job: SchedulerJob = () => {
      if (this.dirty) this.run()
    }

    job.flags! |= SchedulerJobFlags.AllowRecurse
    this._flags |= ReactiveFlags.EffectAllowRecurse
    this.job = job
  }

  run(initialRun?: boolean): void {
    const oldValue = this.old
    const newValue = (this.old = super.run())
    const { immediate, deep, once } = this.opts

    if (initialRun && !immediate) return

    if (
      initialRun ||
      deep ||
      (this.multiSrc
        ? (newValue as any[]).some((v, i) => !isEqual(v, oldValue[i]))
        : !isEqual(newValue, oldValue))
    ) {
      // cleanup before running cb again
      _cleanup(this)
      // WatchCallback
      this.cb(
        newValue,
        // pass undefined as the old value when it's changed for the first time
        oldValue === INITIAL_WATCHER_VALUE
          ? undefined
          : this.multiSrc && oldValue[0] === INITIAL_WATCHER_VALUE
            ? []
            : oldValue,
        this._cln,
      )
      once && this.stop()
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
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  opts: WatchOptions = EMPTY_OBJECT,
): WatchHandle {
  // SSR skips
  if (__SSR__) {
    const noWatch = (() => {}) as WatchHandle
    noWatch.pause = noWatch
    noWatch.resume = noWatch
    noWatch.stop = noWatch
    return noWatch
  }

  const effect = new WatcherEffect(source as any, cb, opts)
  // initial run
  effect.run(true)

  const stop = effect.stop.bind(effect) as WatchHandle
  stop.pause = effect.pause.bind(effect)
  stop.resume = effect.resume.bind(effect)
  stop.stop = stop
  return stop
}
