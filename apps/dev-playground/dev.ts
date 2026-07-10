import { signal, watch } from 'mytng'

const count = signal(0)

const state = signal({
  count: 0,
})

watch(count, () => {
  console.log('count()')
})

watch(
  state,
  () => {
    console.log('state()')
  },
  { deep: true },
)

watch(
  () => state().count,
  () => {
    console.log('state().count')
  },
)

document.addEventListener('click', () => {
  count(count.raw + 1)

  state.raw.count++
  state(state.raw)
})
