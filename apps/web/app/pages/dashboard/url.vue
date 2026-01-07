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
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": auth.bucket.value
                },
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
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AppHeader title="URL Import" back-to="/dashboard" />

        <main class="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8">
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">URL Import</h1>
                <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Webページの内容をスクレイピングしてAIに学習させます
                </p>
            </div>

            <div class="max-w-2xl">
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                                <svg class="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </div>
                            <div>
                                <h2 class="font-semibold text-zinc-900 dark:text-zinc-100">Add URL</h2>
                                <p class="text-xs text-zinc-500">Import web content</p>
                            </div>
                        </div>
                    </div>

                    <div class="p-6 space-y-6">
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                URL
                            </label>
                            <input
                                v-model="url"
                                type="url"
                                placeholder="https://example.com/article"
                                class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                            />
                            <p class="text-xs text-zinc-400">
                                ブログ記事やポートフォリオページのURLを入力してください
                            </p>
                        </div>

                        <button
                            @click="handleSubmit"
                            :disabled="!url || is_loading || !auth.is_configured.value"
                            class="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <svg v-if="is_loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {{ is_loading ? 'Importing...' : 'Import URL' }}
                        </button>

                        <div
                            v-if="message"
                            :class="[
                                'p-4 rounded-lg text-sm',
                                message_type === 'error'
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            ]"
                        >
                            {{ message }}
                        </div>

                        <div
                            v-if="!auth.is_configured.value"
                            class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-sm"
                        >
                            先にダッシュボードでアーティスト設定を行ってください
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
