<script setup lang="ts">
import { ref, nextTick } from "vue"

definePageMeta({
    layout: "dashboard"
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
            content: "Error occurred. Please try again."
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
    <div class="p-6 h-screen flex flex-col">
        <!-- Header -->
        <div class="mb-4">
            <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Hearing</h1>
            <p class="text-sm text-zinc-500">Share feedback to improve the agent</p>
        </div>

        <!-- Chat Container -->
        <div class="flex-1 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden max-w-2xl">
            <!-- Chat Header -->
            <div class="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Feedback</span>
                <span class="text-xs text-zinc-400">{{ hearing_id?.slice(0, 8) || 'New' }}</span>
            </div>

            <!-- Messages -->
            <div ref="messages_container" class="flex-1 overflow-y-auto p-4 space-y-3">
                <div v-if="messages.length === 0" class="h-full flex items-center justify-center">
                    <div class="text-center">
                        <svg class="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p class="text-sm text-zinc-500">Start sharing your feedback</p>
                    </div>
                </div>

                <div
                    v-for="(msg, index) in messages"
                    :key="index"
                    :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
                >
                    <div
                        :class="[
                            'max-w-[80%] px-3 py-2 rounded-lg text-sm',
                            msg.role === 'user'
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                        ]"
                    >
                        <p class="whitespace-pre-wrap leading-relaxed">{{ msg.content }}</p>
                    </div>
                </div>

                <div v-if="is_loading" class="flex justify-start">
                    <div class="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg">
                        <div class="flex items-center gap-1">
                            <div class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
                            <div class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
                            <div class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Input -->
            <div class="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
                <div class="flex items-center gap-2">
                    <input
                        v-model="input"
                        type="text"
                        placeholder="Type your feedback..."
                        @keydown="handleKeydown"
                        :disabled="is_loading || !auth.is_configured.value"
                        class="flex-1 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    />
                    <button
                        @click="handleSend"
                        :disabled="!input.trim() || is_loading || !auth.is_configured.value"
                        class="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white dark:text-zinc-900 disabled:text-zinc-400 rounded text-sm font-medium transition-all disabled:cursor-not-allowed"
                    >
                        Send
                    </button>
                </div>
                <p class="mt-1.5 text-xs text-zinc-400 text-center">
                    <kbd class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">⌘</kbd> + <kbd class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">Enter</kbd> to send
                </p>
            </div>
        </div>
    </div>
</template>
