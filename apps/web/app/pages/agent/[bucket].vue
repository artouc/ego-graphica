<script setup lang="ts">
import { ref, nextTick } from "vue"

definePageMeta({
    layout: "default"
})

const config = useRuntimeConfig()
const route = useRoute()
const bucket = computed(() => route.params.bucket as string)

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

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
                if (line.startsWith("data:")) {
                    const data_str = line.slice(5).trim()
                    if (!data_str) continue

                    try {
                        const data = JSON.parse(data_str)

                        if ("session_id" in data) {
                            session_id.value = data.session_id
                            console.log("[SSE] session:", data.session_id)
                        } else if ("text" in data) {
                            if (current_message_index === -1) {
                                console.log("[SSE] New message started")
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
                        } else if ("message" in data) {
                            console.log("[SSE] Message complete:", data.message.slice(0, 30))
                            if (current_message_index !== -1) {
                                messages.value[current_message_index].streaming = false
                                messages.value[current_message_index].content = data.message
                            }
                            current_message_index = -1
                            await scrollToBottom()
                        } else if ("message_count" in data) {
                            console.log("[SSE] Done, total messages:", data.message_count)
                        } else if ("error" in data) {
                            console.error("[SSE] Error:", data.error)
                            messages.value.push({
                                role: "assistant",
                                content: "エラーが発生しました。もう一度お試しください。"
                            })
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
</script>

<template>
    <div class="container mx-auto py-4 h-screen flex flex-col">
        <div class="flex items-center gap-4 mb-4">
            <NuxtLink to="/dashboard">
                <UiButton variant="ghost" size="sm">← 戻る</UiButton>
            </NuxtLink>
            <h1 class="text-2xl font-bold">エージェントテスト</h1>
            <span class="text-sm text-muted-foreground">バケット: {{ bucket }}</span>
        </div>

        <UiCard class="flex-1 flex flex-col overflow-hidden">
            <UiCardContent class="flex-1 overflow-hidden flex flex-col p-4">
                <div ref="messages_container" class="flex-1 overflow-y-auto space-y-3 mb-3">
                    <div v-if="messages.length === 0" class="text-center text-muted-foreground py-4">
                        <p>AIエージェントに質問してみてください</p>
                    </div>
                    <div
                        v-for="(msg, index) in messages"
                        :key="index"
                        :class="[
                            'p-3 rounded-lg max-w-[80%]',
                            msg.role === 'user'
                                ? 'bg-primary text-primary-foreground ml-auto'
                                : 'bg-muted'
                        ]"
                    >
                        <div class="whitespace-pre-wrap text-sm">
                            {{ msg.content }}
                            <span v-if="msg.streaming" class="animate-pulse">▊</span>
                        </div>
                    </div>
                    <div v-if="is_loading && messages[messages.length - 1]?.role !== 'assistant'" class="p-3 rounded-lg bg-muted max-w-[80%]">
                        <span class="animate-pulse text-sm">考え中...</span>
                    </div>
                </div>

                <div class="flex gap-2">
                    <UiInput
                        v-model="input"
                        placeholder="メッセージを入力... (Cmd/Ctrl + Enter で送信)"
                        @keydown="handleKeydown"
                        :disabled="is_loading"
                        class="flex-1"
                    />
                    <UiButton
                        @click="handleSend"
                        :disabled="!input.trim() || is_loading"
                        size="sm"
                    >
                        送信
                    </UiButton>
                </div>
            </UiCardContent>
        </UiCard>
    </div>
</template>
