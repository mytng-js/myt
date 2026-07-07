import { defineReadonlyProperty, isArray, isEqual, isPlainObject } from '../helpers'
import { ReactiveFlags } from './constants'
import { type ReactiveNode, activeSub, link, propagate, shallowPropagate, tryFlush } from './system'

export interface SignalNode<T = unknown> extends ReactiveNode {
  _update(): boolean
  // current value
  val: T
  // old value
  old: T
}

type ExcludeValues = Function | Map<any, any> | WeakMap<any, any> | Set<any> | WeakSet<any>

export type Signal<T = unknown> = {
  // get and track
  (): T
  // set and trigger
  (newValue: Exclude<T, ExcludeValues>): boolean | void
  /**
   * @desc Untracked original value
   * @readonly
   */
  readonly raw: T
}

/**
 * Checks if a value is a signal object.
 */
export const isSignal = <T>(fn: Function): fn is Signal<T> =>
  fn.name === 'bound ' + _signalOperation.name

/**
 * @example
 * const count = signal(0)
 * // get and track
 * count()
 * // Untracked original value
 * count.raw
 * // set
 * count(1)
 * count(count.raw + 1)
 *
 * const state = signal({ count: 0 })
 * // get and track
 * state().count
 * // Untracked original value
 * state.raw.count
 * // set: new memory address
 * state({ ...state.raw, count: 1 })
 * // trigger
 * state.raw.count++
 * state(state.raw)
 */
export function signal<T>(): Signal<T | undefined>
export function signal<T>(value: Exclude<T, ExcludeValues>): Signal<T>
export function signal<T>(value?: Exclude<T, ExcludeValues>): Signal<T | undefined> {
  const _node: SignalNode<T | undefined> = {
    _subs: undefined,
    _subsTail: undefined,
    _flags: ReactiveFlags.Mutable,
    _update,
    // There is no need to use the `bind` function
    val: value,
    old: value,
  }

  const bound = _signalOperation.bind(_node as SignalNode) as Signal<T | undefined>
  defineReadonlyProperty(bound, 'raw', () => _node.val)
  return bound
}

function _update<T>(this: SignalNode<T>): boolean {
  this._flags &= ~ReactiveFlags.Dirty
  return !isEqual(this.old, (this.old = this.val))
}

function track<T>(dep: SignalNode<T>) {
  if (activeSub !== undefined) {
    link(dep, activeSub)
  }
}

// 1. get and track
function _signalOperation<T>(this: SignalNode<T>, ...args: []): T
// 2. set
function _signalOperation<T>(this: SignalNode<T>, ...args: [T]): void
//
function _signalOperation<T>(this: SignalNode<T>, ...args: [] | [T]): T | boolean | void {
  // ======================================================================
  // 1. get and track
  // ======================================================================
  if (!args.length) {
    // SSR skips tracking
    if (__SSR__) return this.val

    track(this)
    if (this._flags & ReactiveFlags.Dirty && this._update()) {
      const subs = this._subs
      if (subs !== undefined) {
        shallowPropagate(subs)
      }
    }
    return this.val
  }

  // ======================================================================
  // 2. set and trigger
  // ======================================================================
  const oldValue = this.val
  const subs = this._subs
  const newValue = args[0]

  if (isEqual(newValue, oldValue)) {
    // SSR skips tracking
    if (__SSR__) return false

    //  trigger
    if (subs !== undefined && (isPlainObject(oldValue) || isArray(oldValue))) {
      propagate(subs)
      shallowPropagate(subs)
      tryFlush()
      return true
    }
    return false
  }

  // SSR skips tracking
  if (__SSR__) {
    this.old = oldValue
    this.val = newValue
    return
  }

  // set
  this._flags |= ReactiveFlags.Dirty
  this.old = oldValue
  this.val = newValue

  if (subs !== undefined) {
    propagate(subs)
    tryFlush()
  }
}
