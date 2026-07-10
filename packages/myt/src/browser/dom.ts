import { NOOP, getOwnDescriptor } from '../helpers'

type NodeGetter = () => ChildNode | null

let first_child_get: NodeGetter
let next_sibling_get: NodeGetter
let last_child_get: NodeGetter

// @compiler
export const get_first_child = __SSR__
  ? NOOP
  : (node: HTMLElement | Element | Node) => first_child_get.call(node)

export const get_next_sibling = __SSR__
  ? NOOP
  : (node: HTMLElement | Element | Node) => next_sibling_get.call(node)

export const get_last_child = __SSR__
  ? NOOP
  : (node: HTMLElement | Element | Node) => last_child_get.call(node)

export const create_fragment = __SSR__ ? NOOP : () => document.createDocumentFragment()

export const create_comment = __SSR__ ? NOOP : (data?: string) => document.createComment(data || '')

export const create_text = __SSR__ ? NOOP : (data?: string) => document.createTextNode(data || '')

export const clear_textContent = __SSR__
  ? NOOP
  : (node: HTMLElement | Element | Node) => {
      node.textContent = ''
    }

export function _init_dom_operations() {
  if (!!first_child_get) return

  const node_prototype = Node.prototype

  first_child_get = getOwnDescriptor(node_prototype, 'firstChild')!.get as NodeGetter
  next_sibling_get = getOwnDescriptor(node_prototype, 'nextSibling')!.get as NodeGetter
  last_child_get = getOwnDescriptor(node_prototype, 'lastChild')!.get as NodeGetter

  Element.prototype.__click = undefined
}
