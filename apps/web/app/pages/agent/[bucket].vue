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
const session_id = ref<string | null>(null)
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
                                break

                            case "text_delta":
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
                                break

                            case "error":
                                messages.value.push({
                                    role: "assistant",
                                    content: "エラーが発生しました。もう一度お試しください。"
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
            content: "エラーが発生しました。もう一度お試しください。"
        })
    } finally {
        is_loading.value = false
    }
}

onMounted(() => {
    clearLogs()
})
</script>

<template>
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <!-- ヘッダー -->
        <header class="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <div class="max-w-screen-2xl mx-auto px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <!-- 左側: ロゴとナビゲーション -->
                    <div class="flex items-center gap-6">
                        <NuxtLink to="/dashboard" class="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                            <div class="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <span class="text-white font-bold text-sm">eG</span>
                            </div>
                            <span class="font-semibold hidden sm:inline">ego Graphica</span>
                        </NuxtLink>

                        <!-- パンくずリスト -->
                        <nav class="hidden md:flex items-center gap-2 text-sm">
                            <NuxtLink to="/dashboard" class="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                                Dashboard
                            </NuxtLink>
                            <span class="text-zinc-300 dark:text-zinc-600">/</span>
                            <span class="text-zinc-900 dark:text-zinc-100 font-medium">Agent Test</span>
                        </nav>
                    </div>

                    <!-- 右側: バケット情報 -->
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                            <div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">{{ bucket }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <!-- メインコンテンツ -->
        <main class="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8">
            <!-- ページタイトル -->
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Agent Test Console</h1>
                <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    AIエージェントの動作をリアルタイムでテストできます
                </p>
            </div>

            <!-- 2カラムレイアウト -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- 左カラム: チャット (2/3) -->
                <div class="lg:col-span-2">
                    <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden h-[calc(100vh-280px)]">
                        <!-- チャットヘッダー -->
                        <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 class="font-semibold text-zinc-900 dark:text-zinc-100">Chat</h2>
                                        <p class="text-xs text-zinc-500">Session: {{ session_id?.slice(0, 8) || 'New' }}...</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span v-if="is_loading" class="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                                        <div class="w-1.5 h-1.5 bg-violet-600 dark:bg-violet-400 rounded-full animate-ping" />
                                        Processing...
                                    </span>
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
                                <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">Start a conversation</h3>
                                <p class="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                                    AIエージェントにメッセージを送信して、動作をテストしてください
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
                                            ? 'bg-violet-600 text-white rounded-br-md'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md'
                                    ]"
                                >
                                    <p class="text-sm whitespace-pre-wrap leading-relaxed">
                                        {{ msg.content }}
                                        <span v-if="msg.streaming" class="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
                                    </p>
                                </div>
                            </div>

                            <div v-if="is_loading && messages[messages.length - 1]?.role !== 'assistant'" class="flex justify-start">
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
                                    placeholder="Type a message..."
                                    @keydown="handleKeydown"
                                    :disabled="is_loading"
                                    class="flex-1 px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                />
                                <button
                                    @click="handleSend"
                                    :disabled="!input.trim() || is_loading"
                                    class="px-5 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center gap-2"
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

                <!-- 右カラム: ログパネル (1/3) -->
                <div class="lg:col-span-1">
                    <LogPanel class="h-[calc(100vh-280px)]" />
                </div>
            </div>
        </main>
    </div>
</template>
