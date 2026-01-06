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
    <div class="container mx-auto py-8">
        <div class="space-y-6">
            <div class="flex items-center gap-4">
                <NuxtLink to="/dashboard">
                    <UiButton variant="ghost" size="sm">← 戻る</UiButton>
                </NuxtLink>
                <h1 class="text-3xl font-bold">ヒアリング</h1>
            </div>

            <UiCard class="h-[600px] flex flex-col">
                <UiCardHeader>
                    <UiCardTitle>フィードバックを入力</UiCardTitle>
                    <UiCardDescription>
                        エージェントの改善点や違和感があった対応について教えてください
                    </UiCardDescription>
                </UiCardHeader>
                <UiCardContent class="flex-1 overflow-hidden flex flex-col">
                    <!-- メッセージ一覧 -->
                    <div ref="messages_container" class="flex-1 overflow-y-auto space-y-4 mb-4">
                        <div v-if="messages.length === 0" class="text-center text-muted-foreground py-8">
                            <p>エージェントについての感想や改善点を入力してください</p>
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
                            <div class="whitespace-pre-wrap">{{ msg.content }}</div>
                        </div>
                        <div v-if="is_loading" class="p-3 rounded-lg bg-muted max-w-[80%]">
                            <span class="animate-pulse">考え中...</span>
                        </div>
                    </div>

                    <!-- 入力欄 -->
                    <div class="flex gap-2">
                        <UiInput
                            v-model="input"
                            placeholder="メッセージを入力..."
                            @keydown.enter="handleSend"
                            :disabled="is_loading || !auth.is_configured.value"
                        />
                        <UiButton
                            @click="handleSend"
                            :disabled="!input.trim() || is_loading || !auth.is_configured.value"
                        >
                            送信
                        </UiButton>
                    </div>
                </UiCardContent>
            </UiCard>
        </div>
    </div>
</template>
