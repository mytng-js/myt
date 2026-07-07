export const NOOP: (...args: any[]) => any = () => {}

export const assign: typeof Object.assign = Object.assign

export const isEqual: typeof Object.is = Object.is

const _hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = <T extends object>(obj: T, key: PropertyKey): key is keyof T =>
  _hasOwnProperty.call(obj, key)

const _defProperty = Object.defineProperty

export function defineReadonlyProperty<T>(obj: T, key: PropertyKey, get: () => any) {
  _defProperty(obj, key, {
    // configurable: false,
    get,
    set(_: any) {
      if (__DEV__) {
        throw new TypeError(`Property "${String(key)}" is read-only.`)
      }
    },
  })
}

/**
 * @example
 * const num = round(1.23456)
 * // => 1.23
 */
export const round = (num: number, n = 2) => {
  const p = Math.pow(10, n)
  return Math.round(num * p) / p
}

/**
 * @example
 * const removed = removeFromArray([1, 2, 3, 4], 3)
 */
export const removeFromArray = <T>(arr: T[], item: T): boolean | void => {
  const i = arr.indexOf(item)
  if (i > -1) {
    arr.splice(i, 1)
    return true
  }
}
