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
                // イベント名を取得
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
                        current_event = "" // リセット

                        // イベントタイプに基づいて処理
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
                                // 完了
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

// ページ読み込み時にログをクリア
onMounted(() => {
    clearLogs()
})
</script>

<template>
    <div class="h-screen flex flex-col">
        <!-- ヘッダー -->
        <div class="flex items-center gap-4 px-4 py-3 border-b">
            <NuxtLink to="/dashboard">
                <UiButton variant="ghost" size="sm">← 戻る</UiButton>
            </NuxtLink>
            <h1 class="text-xl font-bold">エージェントテスト</h1>
            <span class="text-sm text-muted-foreground">バケット: {{ bucket }}</span>
        </div>

        <!-- 2カラムレイアウト -->
        <div class="flex-1 flex overflow-hidden">
            <!-- 左カラム: チャット -->
            <div class="flex-1 flex flex-col p-4">
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

            <!-- 右カラム: ログパネル -->
            <div class="w-96 py-4 pr-4">
                <LogPanel class="h-full" />
            </div>
        </div>
    </div>
</template>
