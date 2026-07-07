import { isArray, isNumber, isString } from './isType'
import { hasOwn } from './base'

type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | bigint
  | Record<string, any>
  | ClassValue[]

/**
 * @see https://www.npmjs.com/package/clsx
 * @example
 * const classStr = clsx(true, false, '', null, undefined, 0, NaN)
 * // => ''
 *
 * const flexCenter = true
 * const classStr = clsx(flexCenter && 'flex items-center justify-center')
 * // => flex items-center justify-center
 */
export function clsx(...args: ClassValue[]): string {
  const len = args.length
  if (!len) return ''

  let _str = ''
  let space = ''

  for (let i = 0; i < len; i++) {
    if (!args[i]) continue

    if (!space && _str) space = ' '

    const item = args[i]

    if (isString(item) || isNumber(item)) {
      _str += space + item
    } else if (isArray(item)) {
      const s = clsx(...item)
      if (s) _str += space + s
    } else if (typeof item === 'object') {
      for (const key in item) {
        if (hasOwn(item, key) && item[key]) {
          _str += space + key
        }
      }
    }
  }

  return _str
}
