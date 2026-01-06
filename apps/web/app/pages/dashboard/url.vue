<script setup lang="ts">
import { ref } from "vue"

definePageMeta({
    layout: "default"
})

const config = useRuntimeConfig()
const auth = useAuth()
const url = ref("")
const is_loading = ref(false)
const message = ref("")
const message_type = ref<"success" | "error">("success")

async function handleSubmit() {
    if (!url.value || !auth.bucket.value) return

    is_loading.value = true
    message.value = ""

    try {
        const response = await $fetch<{ data: { title: string } }>(
            `${config.public.apiUrl}/api/ingest/url`,
            {
                method: "POST",
                body: {
                    bucket: auth.bucket.value,
                    url: url.value
                }
            }
        )

        message_type.value = "success"
        message.value = `URLを追加しました: ${response.data.title}`
        url.value = ""
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "URLの追加に失敗しました"
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
                <h1 class="text-3xl font-bold">URL追加</h1>
            </div>

            <UiCard>
                <UiCardHeader>
                    <UiCardTitle>URLを入力</UiCardTitle>
                    <UiCardDescription>
                        Webページの内容をスクレイピングしてAIが学習します
                    </UiCardDescription>
                </UiCardHeader>
                <UiCardContent>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <UiLabel for="url">URL</UiLabel>
                            <UiInput
                                id="url"
                                type="url"
                                v-model="url"
                                placeholder="https://example.com/article"
                            />
                        </div>

                        <UiButton
                            @click="handleSubmit"
                            :disabled="!url || is_loading || !auth.is_configured.value"
                            :loading="is_loading"
                        >
                            追加
                        </UiButton>

                        <UiAlert v-if="message" :variant="message_type === 'error' ? 'destructive' : 'default'">
                            {{ message }}
                        </UiAlert>

                        <UiAlert v-if="!auth.is_configured.value" variant="destructive">
                            先にダッシュボードでアーティスト設定を行ってください
                        </UiAlert>
                    </div>
                </UiCardContent>
            </UiCard>
        </div>
    </div>
</template>
