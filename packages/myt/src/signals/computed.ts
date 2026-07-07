import { defineReadonlyProperty, isEqual } from '../helpers'
import { ReactiveFlags } from './constants'
import {
  type ReactiveNode,
  activeSub,
  checkDirty,
  endTracking,
  link,
  shallowPropagate,
  startTracking,
} from './system'
import { activeScope } from './scope'

export interface ComputedNode<T = unknown> extends ReactiveNode {
  _update(): boolean
  // getter
  get: ComputedGetter<T>
  // setter
  set: ComputedSetter<T> | undefined
  // current value
  val: T | undefined
  /**
   * @internal
   */
  __ssr?: boolean
}

export type Computed<T = unknown> = {
  // get and track
  (): T
  /**
   * @desc Untracked original value
   * @readonly
   */
  readonly raw: T | undefined
}

type Writable<T = unknown> = {
  // set
  (newValue: Exclude<T, Function>): void
}

export type WritableComputed<T = unknown> = Computed<T> & Writable<T>

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export const isComputed = <T>(fn: Function): fn is Computed<T> =>
  fn.name === 'bound ' + _computedOperation.name

/**
 * @example
 * const count = signal(0)
 * const doubleCount = computed(() => count() * 2);
 * // get and track
 * doubleCount()
 * // Untracked original value
 * doubleCount.raw
 *
 * // WritableComputed
 * const num = signal(1)
 * const foo = computed(
 *  // getter
 *  () => num() + 1,
 *  // setter
 *  (val) => { num(val - 1) }
 * )
 *
 * foo(1)
 * num() // 0
 */
export function computed<T>(getter: ComputedGetter<T>): Computed<T>
export function computed<T>(
  getter: ComputedGetter<T>,
  setter: ComputedSetter<T>,
): WritableComputed<T>
export function computed<T>(
  getter: ComputedGetter<T>,
  setter?: ComputedSetter<T>,
): Computed<T> | WritableComputed<T> {
  const _node: ComputedNode<T> = {
    _subs: undefined,
    _subsTail: undefined,
    _deps: undefined,
    _depsTail: undefined,
    _flags: ReactiveFlags.Mutable | ReactiveFlags.Dirty,
    _update: update,
    // There is no need to use the `bind` function
    get: getter,
    set: setter,
    val: undefined,
  }

  const bound = _computedOperation.bind(_node as ComputedNode) as Computed<T>
  defineReadonlyProperty(bound, 'raw', () => _node.val)
  return bound
}

function update(this: ComputedNode): boolean {
  const prevSub = startTracking(this)
  try {
    const oldValue = this.val
    const newValue = this.get(oldValue)

    if (!isEqual(oldValue, newValue)) {
      this.val = newValue
      return true
    }
    return false
  } finally {
    endTracking(this, prevSub)
  }
}

// 1. get and track
function _computedOperation<T>(this: ComputedNode<T>, ...args: []): T
// 2. set
function _computedOperation<T>(this: ComputedNode<T>, ...args: [T]): void
function _computedOperation<T>(this: ComputedNode<T>, ...args: [] | [T]): T | void {
  // 1. get and track
  if (!args.length) {
    if (__SSR__) {
      if (!this.__ssr) {
        this.val = this.get(this.val)
        this.__ssr = true
      }
      return this.val
    }

    const flags = this._flags
    if (
      flags & ReactiveFlags.Dirty ||
      (flags & ReactiveFlags.Pending && checkDirty(this._deps!, this))
    ) {
      if (this._update()) {
        const subs = this._subs
        if (subs !== undefined) {
          shallowPropagate(subs)
        }
      }
    } else if (flags & ReactiveFlags.Pending) {
      this._flags = flags & ~ReactiveFlags.Pending
    }

    if (activeSub !== undefined) {
      link(this, activeSub)
    } else if (activeScope !== undefined) {
      link(this, activeScope)
    }
    return this.val
  }

  if (this.set) {
    this.set(args[0])
  } else if (__DEV__) {
    console.warn('[Mytng warn]: Write operation failed: computed value is readonly')
  }
}
