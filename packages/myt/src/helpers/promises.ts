/**
 *
 * `Promise.withResolvers()` API compatibility
 * @see https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
 *
 * @example
 * const [promise, resolve, reject] = withResolvers()
 */
export function withResolvers<T>() {
  let resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return [promise as Promise<T>, resolve!, reject!] as [
    promise: Promise<T>,
    resolve: (value?: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
  ]
}
