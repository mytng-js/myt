import { isArray, isFunction, isObject, isPlainObject } from '../helpers'

import { __SKIP_SYMBOL } from './constants'
import { isSignal } from './signal'
import { isComputed } from './computed'

/**
 * isSignal || isComputed
 */
export function isSignals(obj: unknown) {
  return isFunction(obj) && (isSignal(obj) || isComputed(obj))
}

const getOwnPropSymbols = Object.getOwnPropertySymbols
const propertyIsEnumerable = Object.prototype.propertyIsEnumerable

export function traverse(
  value: unknown,
  depth: number = Infinity,
  seen?: Map<unknown, number>,
): unknown {
  if (depth <= 0 || !isObject(value) || (value as any)[__SKIP_SYMBOL]) {
    return value
  }

  seen = seen || new Map()
  if ((seen.get(value) || 0) >= depth) {
    return value
  }

  seen.set(value, depth)
  depth--

  if (isSignals(value)) {
    traverse(value(), depth, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen)
    }
  } else if (value instanceof Map || value instanceof Set) {
    value.forEach((v: any) => {
      traverse(v, depth, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, seen)
    }

    for (const key of getOwnPropSymbols(value)) {
      if (propertyIsEnumerable.call(value, key)) {
        traverse(value[key as any], depth, seen)
      }
    }
  }
  return value
}
