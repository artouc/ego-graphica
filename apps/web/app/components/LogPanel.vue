<script setup lang="ts">
import { useActivityLog } from "~/composables/useActivityLog"

const { logs, formatLogEntry, clearLogs } = useActivityLog()

const log_container = ref<HTMLElement | null>(null)

// 新しいログが追加されたら自動スクロール
watch(() => logs.value.length, async () => {
    await nextTick()
    if (log_container.value) {
        log_container.value.scrollTop = log_container.value.scrollHeight
    }
})
</script>

<template>
    <div class="h-full flex flex-col bg-zinc-900 text-zinc-100 rounded-lg overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
            <span class="text-sm font-medium text-zinc-400">Activity Log</span>
            <button
                @click="clearLogs"
                class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
                Clear
            </button>
        </div>
        <div
            ref="log_container"
            class="flex-1 overflow-auto p-3 scrollbar-thin font-mono text-xs space-y-1"
        >
            <div v-if="logs.length === 0" class="text-zinc-500 text-center py-4">
                No activity yet
            </div>
            <div
                v-for="entry in logs"
                :key="entry.id"
                :class="[
                    'py-0.5 whitespace-nowrap',
                    entry.type === 'agent' ? 'text-emerald-400' : 'text-sky-400'
                ]"
            >
                <span class="text-zinc-500 mr-2">
                    {{ entry.timestamp.toLocaleTimeString('ja-JP') }}
                </span>
                <span class="mr-3">{{ formatLogEntry(entry) }}</span>
            </div>
        </div>
    </div>
</template>
