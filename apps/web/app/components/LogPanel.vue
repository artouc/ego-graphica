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
    <div class="h-full flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <!-- ヘッダー -->
        <div class="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                        <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Activity Log</h3>
                        <p class="text-xs text-zinc-500">{{ logs.length }} events</p>
                    </div>
                </div>
                <button
                    @click="clearLogs"
                    class="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                >
                    Clear
                </button>
            </div>
        </div>

        <!-- ログコンテンツ -->
        <div
            ref="log_container"
            class="flex-1 overflow-auto p-4"
        >
            <div v-if="logs.length === 0" class="h-full flex flex-col items-center justify-center text-center py-8">
                <div class="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                    <svg class="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <p class="text-sm text-zinc-500 dark:text-zinc-400">No activity yet</p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Events will appear here</p>
            </div>

            <div v-else class="space-y-2">
                <div
                    v-for="entry in logs"
                    :key="entry.id"
                    :class="[
                        'px-3 py-2 rounded-lg text-xs font-mono',
                        entry.type === 'agent'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900'
                            : 'bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900'
                    ]"
                >
                    <div class="flex items-start gap-2">
                        <!-- アイコン -->
                        <div
                            :class="[
                                'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                                entry.type === 'agent'
                                    ? 'bg-emerald-500'
                                    : 'bg-sky-500'
                            ]"
                        >
                            <svg v-if="entry.type === 'agent'" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <svg v-else class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                            </svg>
                        </div>

                        <!-- コンテンツ -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                                <span
                                    :class="[
                                        'font-semibold',
                                        entry.type === 'agent'
                                            ? 'text-emerald-700 dark:text-emerald-400'
                                            : 'text-sky-700 dark:text-sky-400'
                                    ]"
                                >
                                    {{ entry.type === 'agent' ? 'Agent' : 'System' }}
                                </span>
                                <span class="text-zinc-400 dark:text-zinc-500">
                                    {{ entry.timestamp.toLocaleTimeString('ja-JP') }}
                                </span>
                            </div>
                            <p
                                :class="[
                                    'truncate',
                                    entry.type === 'agent'
                                        ? 'text-emerald-600 dark:text-emerald-300'
                                        : 'text-sky-600 dark:text-sky-300'
                                ]"
                            >
                                <template v-if="entry.type === 'agent'">
                                    {{ entry.message }}
                                </template>
                                <template v-else>
                                    {{ entry.category }}
                                    <span v-if="entry.duration !== undefined" class="ml-1 px-1.5 py-0.5 bg-white dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                                        {{ entry.duration }}ms
                                    </span>
                                </template>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
