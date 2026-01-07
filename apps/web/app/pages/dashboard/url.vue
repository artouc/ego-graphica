<script setup lang="ts">
import { ref } from "vue"

definePageMeta({
    layout: "dashboard"
})

const config = useRuntimeConfig()
const auth = useAuth()

interface UrlItem {
    id: string
    url: string
    title: string
}

const url = ref("")
const imported_urls = ref<UrlItem[]>([])
const is_loading = ref(false)
const is_fetching = ref(false)
const message = ref("")
const message_type = ref<"success" | "error">("success")

async function fetchUrls() {
    if (!auth.bucket.value) return

    is_fetching.value = true
    try {
        const response = await $fetch<{ data: { urls: UrlItem[] } }>(
            `${config.public.apiUrl}/api/ingest/urls?bucket=${auth.bucket.value}`,
            {
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": auth.bucket.value
                }
            }
        )
        imported_urls.value = response.data.urls
    } catch (e) {
        console.error("Failed to fetch URLs:", e)
    } finally {
        is_fetching.value = false
    }
}

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
        message.value = `Added: ${response.data.title}`
        url.value = ""

        await fetchUrls()
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "Failed to add URL"
    } finally {
        is_loading.value = false
    }
}

onMounted(() => {
    auth.initializeFromStorage()
    if (auth.bucket.value) {
        fetchUrls()
    }
})

watch(() => auth.bucket.value, (newBucket) => {
    if (newBucket) {
        fetchUrls()
    }
})
</script>

<template>
    <div class="p-6">
        <!-- Header -->
        <div class="mb-4">
            <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">URL Import</h1>
            <p class="text-sm text-zinc-500">Scrape web content for AI analysis</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            <!-- URL Form -->
            <div class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Add URL</h2>
                </div>

                <div class="p-4 space-y-4">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            URL
                        </label>
                        <input
                            v-model="url"
                            type="url"
                            placeholder="https://example.com/article"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all"
                        />
                        <p class="text-xs text-zinc-400">Blog posts, portfolio pages, etc.</p>
                    </div>

                    <button
                        @click="handleSubmit"
                        :disabled="!url || is_loading || !auth.is_configured.value"
                        class="w-full px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white dark:text-zinc-900 disabled:text-zinc-400 rounded text-sm font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <svg v-if="is_loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {{ is_loading ? 'Importing...' : 'Import' }}
                    </button>

                    <div
                        v-if="message"
                        :class="[
                            'p-2 rounded text-sm',
                            message_type === 'error'
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                        ]"
                    >
                        {{ message }}
                    </div>

                    <div
                        v-if="!auth.is_configured.value"
                        class="p-2 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm"
                    >
                        Configure artist settings first
                    </div>
                </div>
            </div>

            <!-- Imported URLs List -->
            <div class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Imported URLs</h2>
                    <span class="text-xs text-zinc-400">{{ imported_urls.length }}</span>
                </div>

                <div class="p-4">
                    <div v-if="is_fetching" class="flex items-center justify-center py-8">
                        <div class="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    </div>

                    <div v-else-if="imported_urls.length === 0" class="py-8 text-center">
                        <p class="text-sm text-zinc-400">No URLs imported yet</p>
                    </div>

                    <div v-else class="space-y-1 max-h-80 overflow-y-auto">
                        <div
                            v-for="item in imported_urls"
                            :key="item.id"
                            class="flex items-center gap-2 p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                            <svg class="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span class="text-sm text-zinc-700 dark:text-zinc-300 truncate">{{ item.title }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
