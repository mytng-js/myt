import {
  isPromise,
  removeFromArray,
  round,
  toRawType,
  toTypeString,
  withResolvers,
} from '../src/helpers'

describe('myt/src/helpers', () => {
  it('isType Tasks:', () => {
    const regx = /\d/
    const date = new Date()
    const set = new Set()
    const map = new Map()
    const obj = {}
    const obj2 = Object.create(null)

    expect(toTypeString(regx)).toBe('[object RegExp]')
    expect(toTypeString(date)).toBe('[object Date]')
    expect(toTypeString(set)).toBe('[object Set]')
    expect(toTypeString(map)).toBe('[object Map]')
    expect(toTypeString(obj)).toBe('[object Object]')
    expect(toTypeString(obj2)).toBe('[object Object]')

    expect(toRawType(regx)).toBe('RegExp')
    expect(toRawType(date)).toBe('Date')
    expect(toRawType(set)).toBe('Set')
    expect(toRawType(map)).toBe('Map')
    expect(toRawType(obj)).toBe('Object')
    expect(toRawType(obj2)).toBe('Object')
    expect(toRawType(undefined)).toBe('Undefined')
    expect(toRawType(null)).toBe('Null')
    expect(toRawType(NaN)).toBe('Number')

    const promise = Promise.resolve()
    const asyncFn = async () => {}

    expect(isPromise(promise)).toBeTruthy()
    expect(isPromise(promise.then(() => {}))).toBeTruthy()
    expect(isPromise(asyncFn())).toBeTruthy()
    expect(isPromise(asyncFn)).toBeFalsy()
  })

  it('withResolvers() fulfilled', async () => {
    const [promise, resolve, reject] = withResolvers<string>()

    expect(promise).toBeInstanceOf(Promise)
    expect(typeof resolve).toBe('function')
    expect(typeof reject).toBe('function')

    resolve('ok')
    await expect(promise).resolves.toBe('ok')
  })

  it('withResolvers() rejected', async () => {
    const [promise, _resolve, reject] = withResolvers<string>()

    reject(new Error('err'))
    await expect(promise).rejects.toThrow('err')
  })

  it('round()', () => {
    expect(round(0.123456)).toBe(0.12)
    expect(round(0.0000111)).toBe(0)
    expect(round(0.00222, 3)).toBe(0.002)
    expect(round(0.000000000222, 10)).toBe(0.0000000002)
  })

  it('removeFromArray()', () => {
    const arr = [1, 2, 3]
    const result = removeFromArray(arr, 2)
    expect(result).toBe(true)
    expect(arr).toEqual([1, 3])

    const arr1 = [1, 2, 3]
    const result1 = removeFromArray(arr1, 4)
    expect(result1).toBeUndefined()
    expect(arr1).toEqual([1, 2, 3])

    const arr2: number[] = []
    const result2 = removeFromArray(arr2, 1)
    expect(result2).toBeUndefined()
    expect(arr2).toEqual([])
  })
})
