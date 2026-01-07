<script setup lang="ts">
import { useActivityLog } from "~/composables/useActivityLog"

const { logs, formatLogEntry, clearLogs } = useActivityLog()

const log_container = ref<HTMLElement | null>(null)

watch(() => logs.value.length, async () => {
    await nextTick()
    if (log_container.value) {
        log_container.value.scrollTop = log_container.value.scrollHeight
    }
})
</script>

<template>
    <div class="h-full flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-zinc-900 dark:text-zinc-100">Activity</span>
                <span class="text-[10px] text-zinc-400">{{ logs.length }}</span>
            </div>
            <button
                @click="clearLogs"
                class="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
                Clear
            </button>
        </div>

        <!-- Logs -->
        <div ref="log_container" class="flex-1 overflow-auto p-2">
            <div v-if="logs.length === 0" class="h-full flex items-center justify-center">
                <p class="text-xs text-zinc-400">No activity</p>
            </div>

            <div v-else class="space-y-1">
                <div
                    v-for="entry in logs"
                    :key="entry.id"
                    class="px-2 py-1.5 rounded text-[11px] font-mono bg-zinc-50 dark:bg-zinc-800"
                >
                    <div class="flex items-center gap-1.5">
                        <div
                            :class="[
                                'w-1.5 h-1.5 rounded-full',
                                entry.type === 'agent' ? 'bg-emerald-500' : 'bg-zinc-400'
                            ]"
                        />
                        <span class="text-zinc-500">{{ entry.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
                    </div>
                    <p class="text-zinc-700 dark:text-zinc-300 mt-0.5 truncate">
                        <template v-if="entry.type === 'agent'">
                            {{ entry.message }}
                        </template>
                        <template v-else>
                            {{ entry.category }}
                            <span v-if="entry.duration !== undefined" class="text-zinc-400 ml-1">
                                {{ entry.duration }}ms
                            </span>
                        </template>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
