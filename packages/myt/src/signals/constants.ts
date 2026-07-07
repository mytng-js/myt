/**
 * @_internal inline const enum
 *
 * @see https://github.com/oxc-project/oxc/issues/6073
 * @see https://github.com/rolldown/rolldown/issues/4342
 */
export const enum ReactiveFlags {
  None = 0,
  Mutable = 1 << 0,
  Watching = 1 << 1,
  RecursedCheck = 1 << 2,
  Recursed = 1 << 3,
  Dirty = 1 << 4,
  Pending = 1 << 5,
  /**
   * Effect only
   */
  EffectAllowRecurse = 1 << 7,
  EffectPaused = 1 << 8,
  EffectStop = 1 << 10,
}

/**
 * @_internal Reactive Symbol Keys
 */
export const __SKIP_SYMBOL = __DEV__ ? Symbol('__skip__') : Symbol()
export const __RAW_SYMBOL = __DEV__ ? Symbol('__raw__') : Symbol()
