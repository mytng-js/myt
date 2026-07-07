import { ReactiveFlags } from './constants'
import type { EffectScope } from './scope'
import { Effect } from './effect'
import type { ComputedNode } from './computed'

/**
 * @_internal Internal Props begin with an underscore (_).
 */
export interface ReactiveNode {
  _deps?: Link
  _depsTail?: Link
  _subs?: Link
  _subsTail?: Link
  _flags: ReactiveFlags
}
// _update?: () => boolean
// _unlink?: VoidFunction
// notify?: VoidFunction

/**
 * @_internal Internal Props begin with an underscore (_).
 */
export interface Link {
  _version: number
  _dep: ReactiveNode | Effect | EffectScope | ComputedNode
  _sub: ReactiveNode | Effect | EffectScope | ComputedNode
  _prevDep: Link | undefined
  _nextDep: Link | undefined
  _prevSub: Link | undefined
  _nextSub: Link | undefined
}

type Stack<T> = {
  value: T
  prev: Stack<T> | undefined
}

const resetTrackingStack: (ReactiveNode | undefined)[] = []
const notifyBuffer: (Effect | undefined)[] = []

let notifyIndex = 0
let notifyBufferLength = 0
let globalVersion = 0
let runDepth = 0

export let batchDepth = 0
export let activeSub: ReactiveNode | undefined

export function incRunDepth(): void {
  ++runDepth
}

export function decRunDepth(): void {
  --runDepth
}

export function setActiveSub(sub?: ReactiveNode) {
  const prevSub = activeSub
  activeSub = sub
  return prevSub
}

export function startBatch(): void {
  ++batchDepth
}

export function endBatch(): void {
  if (!--batchDepth && notifyBufferLength) {
    flush()
  }
}

export function batch<T>(fn: () => T): T {
  startBatch()
  try {
    return fn()
  } finally {
    endBatch()
  }
}

export function tryFlush() {
  !batchDepth && flush()
}

export function flush(): void {
  while (notifyIndex < notifyBufferLength) {
    const effect = notifyBuffer[notifyIndex]!
    notifyBuffer[notifyIndex++] = undefined
    effect.notify()
  }
  notifyIndex = 0
  notifyBufferLength = 0
}

export function startTracking(sub: ReactiveNode) {
  ++globalVersion
  sub._depsTail = undefined
  sub._flags =
    (sub._flags & ~(ReactiveFlags.Recursed | ReactiveFlags.Dirty | ReactiveFlags.Pending)) |
    ReactiveFlags.RecursedCheck
  return setActiveSub(sub)
}

export function endTracking(sub: ReactiveNode, prevSub: ReactiveNode | undefined): void {
  if (__DEV__ && activeSub !== sub) {
    console.warn(
      `[Mytng warn]: Active effect was not restored correctly - this is likely a Mytng signals internal bug.`,
    )
  }

  activeSub = prevSub

  const depsTail = sub._depsTail
  let toRemove = depsTail !== undefined ? depsTail._nextDep : sub._deps
  while (toRemove !== undefined) {
    toRemove = unlink(toRemove, sub)
  }
  sub._flags &= ~ReactiveFlags.RecursedCheck
}

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  resetTrackingStack.push(activeSub)
  activeSub = undefined
}

/**
 * Re-enables effect tracking (if it was paused).
 */
export function enableTracking(): void {
  const isPaused = activeSub === undefined
  if (!isPaused) {
    // Add the current active effect to the trackResetStack so it can be
    // restored by calling resetTracking.
    resetTrackingStack.push(activeSub)
  } else {
    // Add a placeholder to the trackResetStack so we can it can be popped
    // to restore the previous active effect.
    resetTrackingStack.push(undefined)

    for (let i = resetTrackingStack.length - 1; i >= 0; i--) {
      if (resetTrackingStack[i] !== undefined) {
        activeSub = resetTrackingStack[i]
        break
      }
    }
  }
}

/**
 * Resets the previous global effect tracking state.
 */
export function resetTracking(): void {
  if (__DEV__ && resetTrackingStack.length === 0) {
    console.warn(
      `[Mytng warn]: resetTracking() was called when there was no active tracking to reset.`,
    )
  }

  activeSub = resetTrackingStack.length ? resetTrackingStack.pop() : undefined
}

/**
 * Registers a cleanup function for the current active effect.
 * The cleanup function is called right before the next effect run, or when the
 * effect is stopped.
 *
 * Throws a warning if there is no current active effect. The warning can be
 * suppressed by passing `true` to the second argument.
 *
 * @param fn - the cleanup function to be registered
 * @param noWarn - if `true`, will not throw warning when called without
 * an active effect.
 */
export function onEffectCleanup(fn: VoidFunction, noWarn?: boolean): void {
  if (activeSub instanceof Effect) {
    activeSub._cleanups[activeSub._cleanupsLen++] = () => {
      const prevSub = activeSub
      activeSub = undefined
      try {
        fn()
      } finally {
        activeSub = prevSub
      }
    }
  } else if (__DEV__ && !noWarn) {
    console.warn(
      `[Mytng warn]: onEffectCleanup() was called when there was no active effect to associate with.`,
    )
  }
}

// ===================================================================================================
// ===== Reactive system
// ===================================================================================================
export function link(dep: ReactiveNode, sub: ReactiveNode): void {
  const prevDep = sub._depsTail
  if (prevDep !== undefined && prevDep._dep === dep) {
    return
  }

  const nextDep = prevDep !== undefined ? prevDep._nextDep : sub._deps
  if (nextDep !== undefined && nextDep._dep === dep) {
    nextDep._version = globalVersion
    sub._depsTail = nextDep
    return
  }

  const prevSub = dep._subsTail
  if (prevSub !== undefined && prevSub._version === globalVersion && prevSub._sub === sub) {
    return
  }

  // oxfmt-ignore
  const newLink = (sub._depsTail = dep._subsTail = {
    _version: globalVersion,
    _dep: dep,
    _sub:sub,
    _prevDep: prevDep,
    _nextDep: nextDep,
    _prevSub: prevSub,
    _nextSub: undefined,
  })

  if (nextDep !== undefined) {
    nextDep._prevDep = newLink
  }

  if (prevDep !== undefined) {
    prevDep._nextDep = newLink
  } else {
    sub._deps = newLink
  }

  if (prevSub !== undefined) {
    prevSub._nextSub = newLink
  } else {
    dep._subs = newLink
  }
}

export function unlink(link: Link, sub = link._sub): Link | undefined {
  const dep = link._dep,
    prevDep = link._prevDep,
    nextDep = link._nextDep,
    prevSub = link._prevSub,
    nextSub = link._nextSub

  if (nextDep !== undefined) {
    nextDep._prevDep = prevDep
  } else {
    sub._depsTail = prevDep
  }

  if (prevDep !== undefined) {
    prevDep._nextDep = nextDep
  } else {
    sub._deps = nextDep
  }

  if (nextSub !== undefined) {
    nextSub._prevSub = prevSub
  } else {
    dep._subsTail = prevSub
  }

  if (prevSub !== undefined) {
    prevSub._nextSub = nextSub
  } else if ((dep._subs = nextSub) === undefined) {
    // dep._unlink && dep._unlink()
    let toRemove = dep._deps
    if (toRemove !== undefined) {
      do {
        toRemove = unlink(toRemove, dep)
      } while (toRemove !== undefined)
      dep._flags |= ReactiveFlags.Dirty
    }
  }
  return nextDep
}

export function propagate(link: Link): void {
  let next = link._nextSub
  let stack: Stack<Link | undefined> | undefined

  top: do {
    const sub = link._sub
    let flags = sub._flags

    if (flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
      if (
        !(
          flags &
          (ReactiveFlags.RecursedCheck |
            ReactiveFlags.Recursed |
            ReactiveFlags.Dirty |
            ReactiveFlags.Pending)
        )
      ) {
        sub._flags = flags | ReactiveFlags.Pending
        if (runDepth) {
          sub._flags |= ReactiveFlags.Recursed
        }
      } else if (
        //
        !(flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed))
      ) {
        flags = ReactiveFlags.None
      } else if (
        //
        !(flags & ReactiveFlags.RecursedCheck)
      ) {
        sub._flags = (flags & ~ReactiveFlags.Recursed) | ReactiveFlags.Pending
      } else if (
        //
        !(flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) &&
        isValidLink(link, sub)
      ) {
        sub._flags = flags | (ReactiveFlags.Recursed | ReactiveFlags.Pending)
        flags &= ReactiveFlags.Mutable
      } else {
        flags = ReactiveFlags.None
      }

      if (flags & ReactiveFlags.Watching) {
        // notify Buffer
        notify(sub as Effect)
      }

      if (flags & ReactiveFlags.Mutable) {
        const subSubs = sub._subs
        if (subSubs !== undefined) {
          const nextSub = (link = subSubs)._nextSub
          if (nextSub !== undefined) {
            stack = { value: next, prev: stack }
            next = nextSub
          }
          continue
        }
      }
    }

    if ((link = next!) !== undefined) {
      next = link._nextSub
      continue
    }

    while (stack !== undefined) {
      link = stack.value!
      stack = stack.prev
      if (link !== undefined) {
        next = link._nextSub
        continue top
      }
    }

    break
  } while (true)
}

export function checkDirty(link: Link, sub: ReactiveNode): boolean {
  let stack: Stack<Link> | undefined
  let checkDepth = 0
  let dirty = false

  top: do {
    const dep = link._dep
    const flags = dep._flags

    if (sub._flags & ReactiveFlags.Dirty) {
      dirty = true
    } else if (
      (flags & (ReactiveFlags.Mutable | ReactiveFlags.Dirty)) ===
      (ReactiveFlags.Mutable | ReactiveFlags.Dirty)
    ) {
      const subs = dep._subs!
      if ((dep as ComputedNode)._update()) {
        if (subs._nextSub !== undefined) {
          shallowPropagate(subs)
        }
        dirty = true
      }
    } else if (
      (flags & (ReactiveFlags.Mutable | ReactiveFlags.Pending)) ===
      (ReactiveFlags.Mutable | ReactiveFlags.Pending)
    ) {
      stack = { value: link, prev: stack }
      link = dep._deps!
      sub = dep
      ++checkDepth
      continue
    }

    if (!dirty) {
      const nextDep = link._nextDep
      if (nextDep !== undefined) {
        link = nextDep
        continue
      }
    }

    while (checkDepth--) {
      link = stack!.value
      stack = stack!.prev

      if (dirty) {
        const subs = sub._subs!
        if ((sub as ComputedNode)._update()) {
          if (subs._nextSub !== undefined) {
            shallowPropagate(subs)
          }
          sub = link._sub
          continue
        }
        dirty = false
      } else {
        sub._flags &= ~ReactiveFlags.Pending
      }

      sub = link._sub
      const nextDep = link._nextDep
      if (nextDep !== undefined) {
        link = nextDep
        continue top
      }
    }

    return dirty && !!sub._flags
  } while (true)
}

export function shallowPropagate(link: Link): void {
  do {
    const sub = link._sub
    const flags = sub._flags

    if ((flags & (ReactiveFlags.Pending | ReactiveFlags.Dirty)) === ReactiveFlags.Pending) {
      sub._flags = flags | ReactiveFlags.Dirty

      if (
        (flags & (ReactiveFlags.Watching | ReactiveFlags.RecursedCheck)) ===
        ReactiveFlags.Watching
      ) {
        notify(sub as Effect)
      }
    }
  } while ((link = link._nextSub!) !== undefined)
}

function notify(sub: Effect) {
  notifyBuffer[notifyBufferLength++] = sub
}

function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
  let link = sub._depsTail
  while (link !== undefined) {
    if (link === checkLink) {
      return true
    }
    link = link._prevDep
  }
  return false
}
