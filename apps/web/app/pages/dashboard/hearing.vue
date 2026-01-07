<script setup lang="ts">
import { ref, nextTick } from "vue"

definePageMeta({
    layout: "default"
})

const config = useRuntimeConfig()
const auth = useAuth()

const messages = ref<Array<{ role: "user" | "assistant"; content: string }>>([])
const input = ref("")
const is_loading = ref(false)
const hearing_id = ref<string | null>(null)
const messages_container = ref<HTMLElement | null>(null)

async function scrollToBottom() {
    await nextTick()
    if (messages_container.value) {
        messages_container.value.scrollTop = messages_container.value.scrollHeight
    }
}

function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleSend()
    }
}

async function handleSend() {
    if (!input.value.trim() || !auth.bucket.value) return

    const user_message = input.value.trim()
    messages.value.push({ role: "user", content: user_message })
    input.value = ""
    await scrollToBottom()

    is_loading.value = true

    try {
        const response = await $fetch<{ data: { hearing_id: string; message: string } }>(
            `${config.public.apiUrl}/api/hearing`,
            {
                method: "POST",
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": auth.bucket.value
                },
                body: {
                    bucket: auth.bucket.value,
                    message: user_message,
                    hearing_id: hearing_id.value
                }
            }
        )

        hearing_id.value = response.data.hearing_id
        messages.value.push({
            role: "assistant",
            content: response.data.message
        })
        await scrollToBottom()
    } catch (e) {
        messages.value.push({
            role: "assistant",
            content: "エラーが発生しました。もう一度お試しください。"
        })
    } finally {
        is_loading.value = false
    }
}

onMounted(() => {
    auth.initializeFromStorage()
})
</script>

<template>
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AppHeader title="Hearing" back-to="/dashboard" />

        <main class="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8">
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Hearing</h1>
                <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    エージェントの改善点や違和感があった対応について教えてください
                </p>
            </div>

            <div class="max-w-3xl">
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden h-[calc(100vh-280px)]">
                    <!-- ヘッダー -->
                    <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                                <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                            </div>
                            <div>
                                <h2 class="font-semibold text-zinc-900 dark:text-zinc-100">Feedback Chat</h2>
                                <p class="text-xs text-zinc-500">Session: {{ hearing_id?.slice(0, 8) || 'New' }}...</p>
                            </div>
                        </div>
                    </div>

                    <!-- メッセージエリア -->
                    <div ref="messages_container" class="flex-1 overflow-y-auto p-6 space-y-4 h-[calc(100%-140px)]">
                        <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-center">
                            <div class="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                <svg class="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">Share your feedback</h3>
                            <p class="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                                エージェントについての感想や改善点を教えてください
                            </p>
                        </div>

                        <div
                            v-for="(msg, index) in messages"
                            :key="index"
                            :class="[
                                'flex',
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                            ]"
                        >
                            <div
                                :class="[
                                    'max-w-[75%] px-4 py-3 rounded-2xl',
                                    msg.role === 'user'
                                        ? 'bg-amber-500 text-white rounded-br-md'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md'
                                ]"
                            >
                                <p class="text-sm whitespace-pre-wrap leading-relaxed">{{ msg.content }}</p>
                            </div>
                        </div>

                        <div v-if="is_loading" class="flex justify-start">
                            <div class="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-md">
                                <div class="flex items-center gap-1.5">
                                    <div class="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
                                    <div class="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
                                    <div class="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 入力エリア -->
                    <div class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                        <div class="flex items-center gap-3">
                            <input
                                v-model="input"
                                type="text"
                                placeholder="Type your feedback..."
                                @keydown="handleKeydown"
                                :disabled="is_loading || !auth.is_configured.value"
                                class="flex-1 px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            />
                            <button
                                @click="handleSend"
                                :disabled="!input.trim() || is_loading || !auth.is_configured.value"
                                class="px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <span>Send</span>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <p class="mt-2 text-xs text-zinc-400 text-center">
                            Press <kbd class="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-xs">⌘</kbd> + <kbd class="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-xs">Enter</kbd> to send
                        </p>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
