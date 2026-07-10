import { isArray } from '../helpers'

/**
 * @_internal inline const enum
 */
export const enum SchedulerJobFlags {
  None = 0,
  Queued = 1 << 0,
  AllowRecurse = 1 << 1,
  Disposed = 1 << 2,
}

export type SchedulerJobs = SchedulerJob | SchedulerJob[]

export type SchedulerJob = {
  (...args: []): any

  order?: number
  /**
   * flags can technically be undefined, but it can still be used in bitwise operations just like 0.
   */
  flags?: SchedulerJobFlags
}

type CountMap = Map<SchedulerJob, number>

const jobs: SchedulerJob[] = []

let postJobs: SchedulerJob[] = []
let activePostJobs: SchedulerJob[] | null = null
let currentFlushPromise: Promise<void> | null = null
let jobsLength = 0
let flushIndex = 0
let postFlushIndex = 0

const resolvedPromise: Promise<any> = /*@__PURE__*/ Promise.resolve()
const RECURSION_LIMIT = 100

export function nextTick(): Promise<void>
export function nextTick<R>(fn: () => R | Promise<R>): Promise<R>
export function nextTick<R>(fn?: () => R | Promise<R>): Promise<void | R> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(fn) : p
}

export function flushPreFlushCbs(seen?: CountMap): void {
  if (__DEV__) {
    seen = seen || new Map()
  }

  for (let i = flushIndex; i < jobsLength; i++) {
    const cb = jobs[i]
    if (cb.order! & 1 || cb.order === Infinity) {
      continue
    }

    if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
      continue
    }

    jobs.splice(i, 1)
    i--
    jobsLength--

    if (cb.flags! & SchedulerJobFlags.AllowRecurse) {
      cb.flags! &= ~SchedulerJobFlags.Queued
    }
    cb()
    if (!(cb.flags! & SchedulerJobFlags.AllowRecurse)) {
      cb.flags! &= ~SchedulerJobFlags.Queued
    }
  }
}

export function flushPostFlushCbs(seen?: CountMap): void {
  if (postJobs.length) {
    if (activePostJobs) {
      activePostJobs.push(...postJobs)
      postJobs.length = 0
      return
    }

    activePostJobs = postJobs
    postJobs = []

    if (__DEV__) {
      seen = seen || new Map()
    }

    while (postFlushIndex < activePostJobs.length) {
      const cb = activePostJobs[postFlushIndex++]

      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }

      if (cb.flags! & SchedulerJobFlags.AllowRecurse) {
        cb.flags! &= ~SchedulerJobFlags.Queued
      }

      if (!(cb.flags! & SchedulerJobFlags.Disposed)) {
        try {
          cb()
        } finally {
          cb.flags! &= ~SchedulerJobFlags.Queued
        }
      }
    }

    activePostJobs = null
    postFlushIndex = 0
  }
}

export function queuePostFlushJob(jobs: SchedulerJobs, id: number = Infinity) {
  if (!isArray(jobs)) {
    if (activePostJobs && id === -1) {
      activePostJobs.splice(postFlushIndex, 0, jobs)
    } else {
      queueJobWorker(jobs, id, postJobs, postJobs.length, 0)
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip duplicate check here to improve perf
    for (const job of jobs) {
      queueJobWorker(job, id, postJobs, postJobs.length, 0)
    }
  }
  queueFlush()
}

export function queueJob(job: SchedulerJob, id?: number, isPre?: boolean, order = 0) {
  if (
    queueJobWorker(
      job,
      id === undefined
        ? isPre
          ? -2
          : Infinity
        : isPre
          ? id * 2
          : order
            ? // `order / (order + 1)` is monotonic and always < 1, so it sorts
              // same-component Vapor effects without changing component order.
              id * 2 + 1 + order / (order + 1)
            : id * 2 + 1,
      jobs,
      jobsLength,
      flushIndex,
    )
  ) {
    jobsLength++
    queueFlush()
  }
}

function queueJobWorker(
  job: SchedulerJob,
  order: number,
  queue: SchedulerJob[],
  length: number,
  flushIndex: number,
): boolean {
  const flags = job.flags!
  if (!(flags & SchedulerJobFlags.Queued)) {
    job.flags! = flags | SchedulerJobFlags.Queued
    job.order = order
    if (
      flushIndex === length ||
      // fast path when the job id is larger than the tail
      order >= queue[length - 1].order!
    ) {
      queue[length] = job
    } else {
      queue.splice(findInsertionIndex(order, queue, flushIndex, length), 0, job)
    }
    return true
  }
  return false
}

// Use binary-search to find a suitable position in the queue. The queue needs
// to be sorted in increasing order of the job ids. This ensures that:
// 1. Components are updated from parent to child. As the parent is always
//    created before the child it will always have a smaller id.
// 2. If a component is unmounted during a parent component's update, its update
//    can be skipped.
// A pre watcher will have the same id as its component's update job. The
// watcher should be inserted immediately before the update job. This allows
// watchers to be skipped if the component is unmounted by the parent update.
function findInsertionIndex(order: number, queue: SchedulerJob[], start: number, end: number) {
  while (start < end) {
    const middle = (start + end) >>> 1
    if (queue[middle].order! <= order) {
      start = middle + 1
    } else {
      end = middle
    }
  }
  return start
}

function doFlushJobs() {
  try {
    flushJobs()
  } catch (e) {
    currentFlushPromise = null
    throw e
  }
}

function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(doFlushJobs)
  }
}

function flushJobs(seen?: CountMap) {
  if (__DEV__) {
    seen ||= new Map()
  }

  try {
    while (flushIndex < jobsLength) {
      const job = jobs[flushIndex]
      jobs[flushIndex++] = undefined as any

      if (!(job.flags! & SchedulerJobFlags.Disposed)) {
        if (__DEV__ && checkRecursiveUpdates(seen!, job)) {
          continue
        }

        if (job.flags! & SchedulerJobFlags.AllowRecurse) {
          job.flags! &= ~SchedulerJobFlags.Queued
        }

        try {
          job()
        } catch (err) {
          handleError(err)
        } finally {
          if (!(job.flags! & SchedulerJobFlags.AllowRecurse)) {
            job.flags! &= ~SchedulerJobFlags.Queued
          }
        }
      }
    }
  } finally {
    // If there was an error we still need to clear the QUEUED flags
    while (flushIndex < jobsLength) {
      jobs[flushIndex].flags! &= ~SchedulerJobFlags.Queued
      jobs[flushIndex++] = undefined as any
    }

    flushIndex = 0
    jobsLength = 0
    jobs.length = 0

    flushPostFlushCbs(seen)

    currentFlushPromise = null
    // If new jobs have been added to either queue, keep flushing
    if (jobsLength || postJobs.length) {
      flushJobs(seen)
    }
  }
}

function checkRecursiveUpdates(seen: CountMap, fn: SchedulerJob) {
  const count = seen.get(fn) || 0
  if (count > RECURSION_LIMIT) {
    handleError(
      `Maximum recursive updates exceeded.` +
        `This means you have a reactive effect that is mutating its own ` +
        `dependencies and thus recursively triggering itself. Possible sources ` +
        `include component template, render function, updated hook or ` +
        `watcher source function.`,
    )
    return true
  }
  seen.set(fn, count + 1)
  return false
}

function handleError(err: unknown) {
  if (__DEV__) {
    console.warn(`Unhandled error during execution of scheduler flush`)
    throw err
  } else {
    console.error(err)
  }
}
