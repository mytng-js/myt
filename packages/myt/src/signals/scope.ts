import { ReactiveFlags } from './constants'
import { type ReactiveNode, link, unlink } from './system'

let uid = 0

export let activeScope: EffectScope | undefined

export const getCurrentScope = () => activeScope

export function setCurrentScope(scope?: EffectScope) {
  const prevScope = activeScope
  activeScope = scope
  return prevScope
}

export class EffectScope implements ReactiveNode {
  /**
   * @readonly
   */
  readonly uid = uid++
  /**
   * render effect count
   * @internal
   */
  _ec = 0
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
  _flags: ReactiveNode['_flags'] = ReactiveFlags.None
  /**
   * @internal
   */
  _cleanups: VoidFunction[] = []
  /**
   * @internal
   */
  _cleanupsLen = 0

  constructor(detached?: boolean) {
    if (!detached && activeScope) {
      link(this, activeScope)
    }
  }

  get active(): boolean {
    return !(this._flags & ReactiveFlags.EffectStop)
  }

  run<T>(fn: () => T): T | undefined {
    const prevScope = activeScope
    try {
      activeScope = this
      return fn()
    } finally {
      activeScope = prevScope
    }
  }

  pause() {
    if (!(this._flags & ReactiveFlags.EffectPaused)) {
      this._flags |= ReactiveFlags.EffectPaused

      for (let link = this._deps; link !== undefined; link = link._nextDep) {
        const dep = link._dep
        'pause' in dep && dep.pause()
      }
    }
  }

  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume() {
    const flags = this._flags
    if (flags & ReactiveFlags.EffectPaused) {
      this._flags = flags & ~ReactiveFlags.EffectPaused

      for (let link = this._deps; link !== undefined; link = link._nextDep) {
        const dep = link._dep
        'resume' in dep && dep.resume()
      }
    }
  }

  stop() {
    if (!this.active) return
    this._flags = ReactiveFlags.EffectStop
    this.reset()

    const sub = this._subs
    if (sub !== undefined) {
      unlink(sub)
    }
  }

  /**
   * @internal
   */
  reset() {
    let dep = this._deps
    while (dep !== undefined) {
      const node = dep._dep
      if ('stop' in node) {
        dep = dep._nextDep
        node.stop()
      } else {
        dep = unlink(dep, this)
      }
    }
    _cleanup(this)
  }
}

export function _cleanup(sub: Pick<EffectScope, '_cleanups' | '_cleanupsLen'>) {
  const len = sub._cleanupsLen
  if (len) {
    for (let i = 0; i < len; i++) {
      sub._cleanups[i]()
    }
    sub._cleanupsLen = 0
  }
}

export function effectScope(detached?: boolean): EffectScope {
  return new EffectScope(detached)
}

/**
 * Registers a dispose callback on the current active effect scope.
 * The callback will be invoked when the associated effect scope is stopped.
 */
export function onScopeDispose(fn: VoidFunction, noWarn?: boolean) {
  if (activeScope !== undefined) {
    activeScope._cleanups[activeScope._cleanupsLen++] = fn
  } else if (__DEV__ && !noWarn) {
    console.warn(
      `[Mytng warn]: onScopeDispose() is called when there is no active effect scope to be associated with.`,
    )
  }
}
