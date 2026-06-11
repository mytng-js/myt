export const NOOP: (...args: any[]) => void = () => {}

export const assign: typeof Object.assign = Object.assign

export const isEqual: typeof Object.is = Object.is

const _hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (obj: object, key: PropertyKey): key is keyof typeof obj =>
  _hasOwnProperty.call(obj, key)

export const round = (num: number, n = 2) => {
  const p = Math.pow(10, n)
  return Math.round(num * p) / p
}

export const removeFromArray = <T>(arr: T[], item: T): boolean | void => {
  const i = arr.indexOf(item)
  if (i > -1) {
    arr.splice(i, 1)
    return true
  }
}
