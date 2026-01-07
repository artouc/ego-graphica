<script setup lang="ts">
import { ref, nextTick } from "vue"
import { useActivityLog } from "~/composables/useActivityLog"

definePageMeta({
    layout: "default"
})

const config = useRuntimeConfig()
const route = useRoute()
const bucket = computed(() => route.params.bucket as string)

const { addAgentLog, addSystemLog, clearLogs } = useActivityLog()

const messages = ref<Array<{ role: "user" | "assistant"; content: string; streaming?: boolean }>>([])
const input = ref("")
const is_loading = ref(false)
const is_typing = ref(false)
const session_id = ref<string | null>(null)
const messages_container = ref<HTMLElement | null>(null)
let typing_timeout: ReturnType<typeof setTimeout> | null = null

function showTypingWithDelay() {
    // 既存のタイマーをクリア
    if (typing_timeout) {
        clearTimeout(typing_timeout)
    }
    // 300ms後に表示
    typing_timeout = setTimeout(() => {
        is_typing.value = true
        scrollToBottom()
    }, 300)
}

function cancelTyping() {
    if (typing_timeout) {
        clearTimeout(typing_timeout)
        typing_timeout = null
    }
    is_typing.value = false
}

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
    if (!input.value.trim()) return

    const user_message = input.value.trim()
    messages.value.push({ role: "user", content: user_message })
    input.value = ""
    await scrollToBottom()

    is_loading.value = true

    try {
        let current_message_index = -1

        const response = await fetch(`${config.public.apiUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": config.public.masterApiKey,
                "X-Bucket": bucket.value
            },
            body: JSON.stringify({
                bucket: bucket.value,
                message: user_message,
                session_id: session_id.value
            })
        })

        if (!response.ok) {
            throw new Error("Request failed")
        }

        const reader = response.body?.getReader()
        if (!reader) {
            throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let buffer = ""
        let current_event = ""

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
                if (line.startsWith("event:")) {
                    current_event = line.slice(6).trim()
                    continue
                }

                if (line.startsWith("data:")) {
                    const data_str = line.slice(5).trim()
                    if (!data_str) continue

                    try {
                        const data = JSON.parse(data_str)
                        const event_type = current_event
                        current_event = ""

                        switch (event_type) {
                            case "session":
                                session_id.value = data.session_id
                                break

                            case "timing":
                                addSystemLog(data.category, "", data.duration)
                                break

                            case "agent":
                                addAgentLog(data.message)
                                // shouldContinueツール呼び出し時にタイピング表示（遅延付き）
                                if (data.message.includes("shouldContinue")) {
                                    showTypingWithDelay()
                                }
                                break

                            case "text_delta":
                                // 新しいテキストが来たらタイピング表示をキャンセル
                                cancelTyping()
                                if (current_message_index === -1) {
                                    messages.value.push({
                                        role: "assistant",
                                        content: data.text,
                                        streaming: true
                                    })
                                    current_message_index = messages.value.length - 1
                                } else {
                                    messages.value[current_message_index].content += data.text
                                }
                                await scrollToBottom()
                                break

                            case "message_complete":
                                if (current_message_index !== -1) {
                                    messages.value[current_message_index].streaming = false
                                    messages.value[current_message_index].content = data.message
                                }
                                current_message_index = -1
                                await scrollToBottom()
                                break

                            case "done":
                                cancelTyping()
                                break

                            case "error":
                                cancelTyping()
                                messages.value.push({
                                    role: "assistant",
                                    content: "Error occurred. Please try again."
                                })
                                break
                        }
                    } catch (e) {
                        console.error("Failed to parse SSE data:", data_str, e)
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error:", e)
        messages.value.push({
            role: "assistant",
            content: "Error occurred. Please try again."
        })
    } finally {
        is_loading.value = false
        cancelTyping()
    }
}

onMounted(() => {
    clearLogs()
})
</script>

<template>
    <div class="h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
        <!-- Header -->
        <header class="h-12 flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4">
            <div class="flex items-center gap-4 flex-1">
                <NuxtLink to="/dashboard" class="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span class="text-sm">Back</span>
                </NuxtLink>
                <div class="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
                <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Agent Test</span>
            </div>
            <div class="flex items-center gap-2 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
                <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span class="text-zinc-600 dark:text-zinc-400">{{ bucket }}</span>
            </div>
        </header>

        <!-- Main -->
        <div class="flex-1 flex overflow-hidden min-h-0">
            <!-- Chat Panel -->
            <div class="flex-1 flex flex-col min-w-0">
                <!-- Messages -->
                <div ref="messages_container" class="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                    <div v-if="messages.length === 0" class="h-full flex items-center justify-center">
                        <div class="text-center">
                            <svg class="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p class="text-sm text-zinc-500">Start a conversation</p>
                        </div>
                    </div>

                    <div
                        v-for="(msg, index) in messages"
                        :key="index"
                        :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
                    >
                        <div
                            :class="[
                                'max-w-[70%] px-3 py-2 rounded-lg text-sm',
                                msg.role === 'user'
                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                    : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
                            ]"
                        >
                            <p class="whitespace-pre-wrap leading-relaxed">
                                {{ msg.content }}
                                <span v-if="msg.streaming" class="inline-block w-1 h-3 bg-current animate-pulse ml-0.5" />
                            </p>
                        </div>
                    </div>

                    <!-- Initial loading indicator -->
                    <div v-if="is_loading && messages[messages.length - 1]?.role !== 'assistant' && !is_typing" class="flex justify-start">
                        <div class="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg">
                            <div class="flex items-center gap-1">
                                <div class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
                                <div class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
                                <div class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
                            </div>
                        </div>
                    </div>

                    <!-- Typing indicator (shouldContinue) -->
                    <div v-if="is_typing" class="flex justify-start">
                        <div class="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg">
                            <div class="flex items-center gap-1">
                                <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 0ms" />
                                <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 150ms" />
                                <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 300ms" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Input -->
                <div class="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
                    <div class="flex items-center gap-2 max-w-3xl mx-auto">
                        <input
                            v-model="input"
                            type="text"
                            placeholder="Type a message..."
                            @keydown="handleKeydown"
                            :disabled="is_loading"
                            class="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 transition-all"
                        />
                        <button
                            @click="handleSend"
                            :disabled="!input.trim() || is_loading"
                            class="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white dark:text-zinc-900 disabled:text-zinc-400 rounded text-sm font-medium transition-all disabled:cursor-not-allowed"
                        >
                            Send
                        </button>
                    </div>
                    <p class="mt-2 text-xs text-zinc-400 text-center">
                        <kbd class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">⌘</kbd> + <kbd class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">Enter</kbd>
                    </p>
                </div>
            </div>

            <!-- Log Panel -->
            <div class="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden lg:flex lg:flex-col overflow-hidden">
                <LogPanel class="h-full min-h-0" />
            </div>
        </div>
    </div>
</template>
