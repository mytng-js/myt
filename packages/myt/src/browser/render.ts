import type { AnyFunction } from '../typeUtils'
// import { withResolvers } from '../helpers'
import { effectScope } from '../signals'
import { _init_dom_operations } from './dom'

export type BaseProps = {
  [x: string]: any
}

export type Component<P extends BaseProps = {}> = {
  (props: P): void
}

/**
 *
 * @example
 * import { hydrate } from 'mytng'
 * import App from './App.myt'
 *
 * hydrate(App, {})
 */
export function hydrate(App: Component, props?: BaseProps) {
  if (__SSR__) return

  _init_dom_operations()

  // const [promise, resolve, reject] = withResolvers()

  renderComponent(App, props)
}

export function renderComponent(Component: Component, props?: BaseProps) {
  const scope = effectScope()
  scope.run(Component as AnyFunction, props || {})
}
