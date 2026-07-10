import { NOOP } from '../helpers'
import { type SchedulerJob, SchedulerJobFlags, queueJob } from '../browser'
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

  run(...args: any[]): T {
    const { active, fn } = this
    if (!active) return fn(...args)

    _cleanup(this)
    const prevSub = startTracking(this)
    incRunDepth()

    try {
      return fn(...args)
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

type NullState = Record<string | number, any>

/**
 * Provided for compiler injection
 * @compiler
 */
export function renderEffect(fn: (cacheState: NullState) => void) {
  const cacheState = Object.create(null) as NullState

  if (__SSR__) {
    fn(cacheState)
  } else {
    const e = new Effect(fn) as RenderEffect
    e.order = e.s ? e.s._ec++ : 0
    e._flags |= ReactiveFlags.EffectAllowRecurse
    e.notify = renderNotify

    const job: SchedulerJob = () => {
      if (e.dirty) e.run(cacheState)
    }
    job.flags! |= SchedulerJobFlags.AllowRecurse
    e.job = job
    e.run(cacheState)
  }
}

function renderNotify(this: RenderEffect) {
  if (!(this._flags & ReactiveFlags.EffectPaused)) {
    queueJob(this.job, this.s ? this.s.uid : undefined, false, this.order)
  }
}
