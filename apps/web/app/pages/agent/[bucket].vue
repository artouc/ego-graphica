<script setup lang="ts">
import { ref, nextTick } from "vue"

definePageMeta({
    layout: "default"
})

const config = useRuntimeConfig()
const route = useRoute()
const bucket = computed(() => route.params.bucket as string)

const messages = ref<Array<{ role: "user" | "assistant"; content: string }>>([])
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

async function handleSend() {
    if (!input.value.trim()) return

    const user_message = input.value.trim()
    messages.value.push({ role: "user", content: user_message })
    input.value = ""
    await scrollToBottom()

    is_loading.value = true

    try {
        const response = await $fetch<{ data: { session_id: string; message: string } }>(
            `${config.public.apiUrl}/api/chat`,
            {
                method: "POST",
                body: {
                    bucket: bucket.value,
                    message: user_message,
                    session_id: session_id.value
                }
            }
        )

        session_id.value = response.data.session_id
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
</script>

<template>
    <div class="container mx-auto py-8 h-screen flex flex-col">
        <div class="flex items-center gap-4 mb-6">
            <NuxtLink to="/dashboard">
                <UiButton variant="ghost" size="sm">← 戻る</UiButton>
            </NuxtLink>
            <h1 class="text-3xl font-bold">エージェントテスト</h1>
            <span class="text-sm text-muted-foreground">バケット: {{ bucket }}</span>
        </div>

        <UiCard class="flex-1 flex flex-col overflow-hidden">
            <UiCardContent class="flex-1 overflow-hidden flex flex-col p-4">
                <!-- メッセージ一覧 -->
                <div ref="messages_container" class="flex-1 overflow-y-auto space-y-4 mb-4">
                    <div v-if="messages.length === 0" class="text-center text-muted-foreground py-8">
                        <p class="text-lg mb-2">こんにちは！</p>
                        <p>AIエージェントに質問してみてください</p>
                    </div>
                    <div
                        v-for="(msg, index) in messages"
                        :key="index"
                        :class="[
                            'p-4 rounded-lg max-w-[80%]',
                            msg.role === 'user'
                                ? 'bg-primary text-primary-foreground ml-auto'
                                : 'bg-muted'
                        ]"
                    >
                        <div class="whitespace-pre-wrap">{{ msg.content }}</div>
                    </div>
                    <div v-if="is_loading" class="p-4 rounded-lg bg-muted max-w-[80%]">
                        <span class="animate-pulse">考え中...</span>
                    </div>
                </div>

                <!-- 入力欄 -->
                <div class="flex gap-2">
                    <UiInput
                        v-model="input"
                        placeholder="メッセージを入力..."
                        @keydown.enter="handleSend"
                        :disabled="is_loading"
                        class="flex-1"
                    />
                    <UiButton
                        @click="handleSend"
                        :disabled="!input.trim() || is_loading"
                    >
                        送信
                    </UiButton>
                </div>
            </UiCardContent>
        </UiCard>
    </div>
</template>
