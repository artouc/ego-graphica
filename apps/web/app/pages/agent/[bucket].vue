<script setup lang="ts">
import { ref, nextTick } from "vue"

definePageMeta({
    layout: "default"
})

interface DebugInfo {
    timings: Record<string, number>
    cache_hits: {
        cag: boolean
        session: boolean
        vector: boolean
        embedding: boolean
    }
    rag: string
    cag: {
        persona: {
            character?: string
            philosophy?: string
            writing_style?: string
        } | null
        rag_summary: string
    }
    context_injection: string
}

const config = useRuntimeConfig()
const route = useRoute()
const bucket = computed(() => route.params.bucket as string)

const messages = ref<Array<{ role: "user" | "assistant"; content: string }>>([])
const input = ref("")
const is_loading = ref(false)
const is_typing = ref(false) // 追加メッセージ入力中
const session_id = ref<string | null>(null)
const messages_container = ref<HTMLElement | null>(null)
const debug_info = ref<DebugInfo | null>(null)

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

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function handleSend() {
    if (!input.value.trim()) return

    const user_message = input.value.trim()
    messages.value.push({ role: "user", content: user_message })
    input.value = ""
    await scrollToBottom()

    is_loading.value = true
    debug_info.value = null

    try {
        const response = await $fetch<{
            data: {
                session_id: string
                messages: string[] // 複数メッセージ
                _debug: DebugInfo
            }
        }>(
            `${config.public.apiUrl}/api/chat`,
            {
                method: "POST",
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": bucket.value
                },
                body: {
                    bucket: bucket.value,
                    message: user_message,
                    session_id: session_id.value
                }
            }
        )

        session_id.value = response.data.session_id
        debug_info.value = response.data._debug
        is_loading.value = false

        // 複数メッセージを順番に表示（リアル感を出すためdelayあり）
        const ai_messages = response.data.messages
        for (let i = 0; i < ai_messages.length; i++) {
            if (i > 0) {
                // 2つ目以降のメッセージは少し待ってから表示
                is_typing.value = true
                await scrollToBottom()
                await sleep(800 + Math.random() * 400) // 800-1200ms
                is_typing.value = false
            }
            messages.value.push({
                role: "assistant",
                content: ai_messages[i]
            })
            await scrollToBottom()
        }
    } catch (e) {
        messages.value.push({
            role: "assistant",
            content: "エラーが発生しました。もう一度お試しください。"
        })
    } finally {
        is_loading.value = false
        is_typing.value = false
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

        <!-- 上半分: チャット -->
        <UiCard class="flex-1 flex flex-col overflow-hidden mb-4" style="max-height: 50%;">
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
                        <div class="whitespace-pre-wrap text-sm">{{ msg.content }}</div>
                    </div>
                    <div v-if="is_loading" class="p-3 rounded-lg bg-muted max-w-[80%]">
                        <span class="animate-pulse text-sm">考え中...</span>
                    </div>
                    <div v-if="is_typing" class="p-3 rounded-lg bg-muted max-w-[80%]">
                        <span class="animate-pulse text-sm">入力中...</span>
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

        <!-- 下半分: ログウィンドウ -->
        <UiCard class="flex-1 flex flex-col overflow-hidden" style="max-height: 50%;">
            <UiCardHeader class="py-2 px-4 border-b">
                <UiCardTitle class="text-sm font-medium">参照データログ</UiCardTitle>
            </UiCardHeader>
            <UiCardContent class="flex-1 overflow-y-auto p-0">
                <div v-if="!debug_info" class="text-center text-muted-foreground py-8 text-sm">
                    会話を開始すると参照データが表示されます
                </div>
                <div v-else class="text-xs font-mono">
                    <!-- Redis Cache Status -->
                    <div class="border-b">
                        <div class="bg-red-500/10 px-3 py-1.5 font-semibold text-red-600 dark:text-red-400 flex items-center justify-between">
                            <span>Upstash Redis Cache</span>
                            <span class="text-xs opacity-70">Total: {{ debug_info.timings.total }}ms</span>
                        </div>
                        <div class="px-3 py-2 bg-muted/30 grid grid-cols-2 gap-2">
                            <div class="flex items-center gap-2">
                                <span :class="debug_info.cache_hits.cag ? 'text-green-500' : 'text-yellow-500'">
                                    {{ debug_info.cache_hits.cag ? 'HIT' : 'MISS' }}
                                </span>
                                <span class="text-muted-foreground">CAG Context</span>
                                <span class="opacity-50">({{ debug_info.timings.cag }}ms)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span :class="debug_info.cache_hits.session ? 'text-green-500' : 'text-yellow-500'">
                                    {{ debug_info.cache_hits.session ? 'HIT' : 'MISS' }}
                                </span>
                                <span class="text-muted-foreground">Session</span>
                                <span class="opacity-50">({{ debug_info.timings.history }}ms)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span :class="debug_info.cache_hits.embedding ? 'text-green-500' : 'text-yellow-500'">
                                    {{ debug_info.cache_hits.embedding ? 'HIT' : 'MISS' }}
                                </span>
                                <span class="text-muted-foreground">Embedding</span>
                                <span class="opacity-50">({{ debug_info.timings.embedding }}ms)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span :class="debug_info.cache_hits.vector ? 'text-green-500' : 'text-yellow-500'">
                                    {{ debug_info.cache_hits.vector ? 'HIT' : 'MISS' }}
                                </span>
                                <span class="text-muted-foreground">Vector Search</span>
                                <span class="opacity-50">({{ debug_info.timings.vector_search }}ms)</span>
                            </div>
                        </div>
                    </div>

                    <!-- RAG -->
                    <div class="border-b">
                        <div class="bg-blue-500/10 px-3 py-1.5 font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                            <span>RAG (Realtime Search)</span>
                            <span class="text-xs opacity-70">{{ debug_info.timings.embedding + debug_info.timings.vector_search }}ms</span>
                        </div>
                        <pre class="px-3 py-2 whitespace-pre-wrap break-all max-h-32 overflow-y-auto bg-muted/30">{{ debug_info.rag }}</pre>
                    </div>

                    <!-- CAG -->
                    <div class="border-b">
                        <div class="bg-green-500/10 px-3 py-1.5 font-semibold text-green-600 dark:text-green-400 flex items-center justify-between">
                            <span>CAG (Cached Context)</span>
                            <span class="text-xs opacity-70">{{ debug_info.timings.cag }}ms</span>
                        </div>
                        <div class="px-3 py-2 bg-muted/30">
                            <div v-if="debug_info.cag.persona" class="mb-2">
                                <span class="text-muted-foreground">Persona:</span>
                                <span class="ml-1">{{ debug_info.cag.persona.character || "(名前なし)" }}</span>
                            </div>
                            <div class="text-muted-foreground mb-1">RAG Summary:</div>
                            <pre class="whitespace-pre-wrap break-all max-h-24 overflow-y-auto">{{ debug_info.cag.rag_summary }}</pre>
                        </div>
                    </div>

                    <!-- Context Injection -->
                    <div>
                        <div class="bg-purple-500/10 px-3 py-1.5 font-semibold text-purple-600 dark:text-purple-400 flex items-center justify-between">
                            <span>Context Injection (Final)</span>
                            <span class="text-xs opacity-70">AI: {{ debug_info.timings.ai_call }}ms</span>
                        </div>
                        <pre class="px-3 py-2 whitespace-pre-wrap break-all max-h-32 overflow-y-auto bg-muted/30">{{ debug_info.context_injection }}</pre>
                    </div>
                </div>
            </UiCardContent>
        </UiCard>
    </div>
</template>
