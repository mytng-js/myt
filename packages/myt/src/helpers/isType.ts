export const isString = (obj: unknown): obj is string => typeof obj === 'string'

export const isNumber = (obj: unknown): obj is number => typeof obj === 'number'

export const isSymbol = (obj: unknown): obj is symbol => typeof obj === 'symbol'

export const isFunction = <T extends Function>(obj: unknown): obj is T => typeof obj === 'function'

const _toString = Object.prototype.toString

export const toTypeString = (obj: unknown): ObjectTypeString => _toString.call(obj)

export const toRawType = (obj: unknown): RawTypeString => toTypeString(obj).slice(8, -1)

export const isArray = Array.isArray

export const isObject = <T extends Record<any, any>>(obj: unknown): obj is T =>
  obj !== null && typeof obj === 'object'

export const isPlainObject = <T extends object>(obj: unknown): obj is T =>
  toTypeString(obj) === '[object Object]'

export const isMap = <K, V>(obj: unknown): obj is Map<K, V> => toTypeString(obj) === '[object Map]'

export const isSet = <T>(obj: unknown): obj is Set<T> => toTypeString(obj) === '[object Set]'

export const isDate = (obj: unknown): obj is Date => toTypeString(obj) === '[object Date]'

export const isRegExp = (obj: unknown): obj is RegExp => toTypeString(obj) === '[object RegExp]'

export const isPromise = <T = any>(obj: unknown): obj is Promise<T> =>
  (isObject(obj) || isFunction(obj)) &&
  isFunction((obj as any).then) &&
  isFunction((obj as any).catch)

export type RawTypeString = ExtractRawType<ObjectTypeString>

type ExtractRawType<T extends `[object ${string}]` | (string & {})> =
  T extends `[object ${infer R}]` ? R : string & {}

export type ObjectTypeString =
  | '[object Undefined]'
  | '[object Null]'
  | '[object Boolean]'
  | '[object Number]'
  | '[object String]'
  | '[object Symbol]'
  | '[object BigInt]'
  | '[object Object]'
  | '[object Array]'
  | '[object Function]'
  | '[object AsyncFunction]'
  | '[object GeneratorFunction]'
  | '[object Promise]'
  | '[object Map]'
  | '[object WeakMap]'
  | '[object Set]'
  | '[object WeakSet]'
  | '[object Date]'
  | '[object RegExp]'
  | '[object ArrayBuffer]'
  | '[object Error]'
  | '[object Window]'
  | (string & {})
