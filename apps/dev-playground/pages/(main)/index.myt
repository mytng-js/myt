import { signal, computed, watch } from 'mytng'

export const pageConfig = {}

export function Head() {
}

export default function HomePage() {
    const count = signal(0)
    const doubleCount = computed(() => count() * 2)

    watch(doubleCount, async (val) => {
        console.log(val)
    })

    <div class="counter">
        <div>count: {count()}</div>
        <div>doubleCount: {doubleCount()}</div>

        <button onClick={() => count(count.raw - 1)}>-</button>
        <button onClick={() => count(count.raw + 1)}>+</button>

        @if (count() > 0) {
            <button onClick={() => count(0)}>reset</button>
        }
    </div>
    
    <style>
        .counter {
            padding: 12px;
        }
    </style>
}
