import { NOOP } from '../helpers'
import { type SchedulerJob, SchedulerJobFlags, queueJob } from '../core'
import { ReactiveFlags } from './constants'
import {
  type ReactiveNode,
  checkDirty,
  decRunDepth,
  endTracking,
  incRunDepth,
  link,
  startTracking,
  unlink,
} from './system'
import { type EffectScope, _cleanup, activeScope } from './scope'

export class Effect<T = void> implements ReactiveNode {
  readonly s: EffectScope | undefined = activeScope
  /**
   * Internal Props begin with an underscore (_).
   * @internal
   */
  _deps: ReactiveNode['_deps'] = undefined
  /**
   * @internal
   */
  _depsTail: ReactiveNode['_depsTail'] = undefined
  /**
   * @internal
   */
  _subs: ReactiveNode['_subs'] = undefined
  /**
   * @internal
   */
  _subsTail: ReactiveNode['_subsTail'] = undefined
  /**
   * @internal
   */
  _flags: ReactiveNode['_flags'] = ReactiveFlags.Watching | ReactiveFlags.Dirty
  /**
   * @internal
   */
  _cleanups: VoidFunction[] = []
  /**
   * @internal
   */
  _cleanupsLen = 0

  fn: (...args: any[]) => T

  constructor(fn?: (...args: any[]) => T) {
    this.fn = fn || NOOP
    if (activeScope) {
      link(this, activeScope)
    }
  }

  get active(): boolean {
    return !(this._flags & ReactiveFlags.EffectStop)
  }

  get dirty(): boolean {
    const flags = this._flags
    if (flags & ReactiveFlags.Dirty) {
      return true
    }

    if (flags & ReactiveFlags.Pending) {
      if (checkDirty(this._deps!, this)) {
        this._flags = flags | ReactiveFlags.Dirty
        return true
      } else {
        this._flags = flags & ~ReactiveFlags.Pending
      }
    }
    return false
  }

  run(initState?: any): T {
    if (!this.active) return this.fn(initState)

    _cleanup(this)
    const prevSub = startTracking(this)
    incRunDepth()

    try {
      return this.fn(initState)
    } finally {
      decRunDepth()
      endTracking(this, prevSub)

      const flags = this._flags
      if (
        (flags & (ReactiveFlags.Recursed | ReactiveFlags.EffectAllowRecurse)) ===
        (ReactiveFlags.Recursed | ReactiveFlags.EffectAllowRecurse)
      ) {
        this._flags = flags & ~ReactiveFlags.Recursed
        this.notify()
      }
    }
  }

  notify() {
    if (!(this._flags & ReactiveFlags.EffectPaused) && this.dirty) {
      this.run()
    }
  }

  pause() {
    this._flags |= ReactiveFlags.EffectPaused
  }

  resume() {
    const flags = (this._flags &= ~ReactiveFlags.EffectPaused)
    if (flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) {
      this.notify()
    }
  }

  stop() {
    if (!this.active) return

    this._flags = ReactiveFlags.EffectStop
    let dep = this._deps
    while (dep !== undefined) {
      dep = unlink(dep, this)
    }

    const sub = this._subs
    if (sub !== undefined) {
      unlink(sub)
    }
    _cleanup(this)
  }
}

interface RenderEffect extends Effect {
  order: number
  job: SchedulerJob
}

/**
 * Provided for compiler injection
 * @compiler
 */
export function renderEffect<T extends Record<PropertyKey, any>>(
  fn: (prevState: T) => void,
  state: T,
) {
  if (__SSR__) {
    fn(state)
  } else {
    const e = new Effect(fn) as RenderEffect
    e.order = e.s ? e.s._ec++ : 0
    e._flags |= ReactiveFlags.EffectAllowRecurse
    e.notify = renderNotify

    const job: SchedulerJob = () => {
      if (e.dirty) e.run(state)
    }
    job.order = 0
    job.flags! |= SchedulerJobFlags.AllowRecurse
    e.job = job
    e.run(state)
  }
}

function renderNotify(this: RenderEffect) {
  if (!(this._flags & ReactiveFlags.EffectPaused)) {
    queueJob(this.job, this.s ? this.s.uid : undefined, false, this.order)
  }
}

// ============================================================================================
// ============================================================================================
// ============================================================================================
export interface EffectOptions {
  scheduler?: (...args: any[]) => any
  stop?: VoidFunction
}

export interface EffectRunner<T = any> {
  (): T
  stop(): void
  /**
   * @internal
   */
  e: Effect<T>
}

/**
 * base effect
 * @example
 * const run = effect(() => {}, {
 *  scheduler: () => queueMicrotask(run)
 * })
 */
export function effect<T = void>(fn: () => T, options?: EffectOptions): EffectRunner<T> {
  const e = new Effect(fn)

  if (__SSR__) {
    e.run = NOOP
  }

  if (options) {
    const { stop, scheduler } = options
    if (stop) {
      const _stop = e.stop
      e.stop = () => {
        _stop.call(e)
        stop()
      }
    }

    if (scheduler) {
      e.notify = () => {
        if (!(e._flags & ReactiveFlags.EffectPaused)) {
          scheduler()
        }
      }
    }
  }

  try {
    e.run()
  } catch (err) {
    e.stop()
    throw err
  }

  const runner = e.run.bind(e) as EffectRunner
  runner.e = e
  runner.stop = _stopEffect
  return runner
}

/**
 * Stops the effect associated with the given runner.
 */
function _stopEffect(this: EffectRunner): void {
  this.e.stop()
}
