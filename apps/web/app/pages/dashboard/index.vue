<script setup lang="ts">
import { ref, computed, onMounted } from "vue"

definePageMeta({
    layout: "default"
})

const auth = useAuth()

const form = ref({
    name: "",
    bucket: ""
})

const auto_bucket = ref(true)

const generated_bucket = computed(() => {
    if (!form.value.name) return ""
    return form.value.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32)
})

const actual_bucket = computed(() => {
    return auto_bucket.value ? generated_bucket.value : form.value.bucket
})

function handleSave() {
    if (!form.value.name || !actual_bucket.value) return
    auth.saveSettings(actual_bucket.value, form.value.name)
}

function handleReset() {
    auth.clearSettings()
    form.value.name = ""
    form.value.bucket = ""
}

onMounted(() => {
    auth.initializeFromStorage()
    if (auth.artist_name.value) {
        form.value.name = auth.artist_name.value
    }
    if (auth.bucket.value) {
        form.value.bucket = auth.bucket.value
        auto_bucket.value = false
    }
})

const menu_items = [
    {
        to: "/dashboard/upload",
        title: "File Upload",
        description: "PDF、画像、音声ファイルをアップロードしてAI解析",
        icon: "upload"
    },
    {
        to: "/dashboard/url",
        title: "URL Import",
        description: "Webコンテンツをスクレイピングして解析",
        icon: "link"
    },
    {
        to: "/dashboard/works",
        title: "Works",
        description: "作品ポートフォリオの追加・整理",
        icon: "image"
    },
    {
        to: "/dashboard/persona",
        title: "Persona",
        description: "エージェントのキャラクターと話し方を定義",
        icon: "user"
    },
    {
        to: "/dashboard/hearing",
        title: "Hearing",
        description: "エージェント改善のためのフィードバック",
        icon: "message"
    }
]
</script>

<template>
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AppHeader title="Dashboard" />

        <main class="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8">
            <!-- ページタイトル -->
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
                <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    ego Graphicaの管理画面へようこそ
                </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- 左カラム: 設定 -->
                <div class="lg:col-span-1">
                    <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                        <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                                    <svg class="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 class="font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
                                    <p class="text-xs text-zinc-500">アーティスト設定</p>
                                </div>
                            </div>
                        </div>

                        <div class="p-6 space-y-4">
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    Artist Name
                                </label>
                                <input
                                    v-model="form.name"
                                    type="text"
                                    placeholder="アーティスト名を入力"
                                    class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                />
                            </div>

                            <div class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                        Bucket ID
                                    </label>
                                    <label class="flex items-center gap-2 text-xs text-zinc-500">
                                        <input
                                            type="checkbox"
                                            v-model="auto_bucket"
                                            class="rounded border-zinc-300 dark:border-zinc-600 text-violet-600 focus:ring-violet-500"
                                        />
                                        Auto
                                    </label>
                                </div>
                                <input
                                    v-model="form.bucket"
                                    type="text"
                                    :placeholder="auto_bucket ? generated_bucket : 'バケット名を入力'"
                                    :disabled="auto_bucket"
                                    class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                />
                                <p class="text-xs text-zinc-400">
                                    リソースの一意識別子
                                </p>
                            </div>

                            <div class="flex gap-2 pt-2">
                                <button
                                    @click="handleSave"
                                    :disabled="!form.name || !actual_bucket"
                                    class="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-lg font-medium text-sm transition-all disabled:cursor-not-allowed"
                                >
                                    Save
                                </button>
                                <button
                                    v-if="auth.is_configured.value"
                                    @click="handleReset"
                                    class="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium text-sm transition-all"
                                >
                                    Reset
                                </button>
                            </div>

                            <div v-if="auth.is_configured.value" class="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                                <div class="flex items-center gap-2">
                                    <div class="w-2 h-2 bg-emerald-500 rounded-full" />
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400">
                                        <strong class="text-zinc-900 dark:text-zinc-100">{{ auth.artist_name.value }}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右カラム: メニュー -->
                <div class="lg:col-span-2">
                    <div v-if="auth.is_configured.value" class="space-y-6">
                        <!-- Agent Test Card -->
                        <NuxtLink :to="`/agent/${auth.bucket.value}`">
                            <div class="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-6 text-white hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
                                <div class="flex items-center gap-4">
                                    <div class="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-xl font-bold">Agent Test Console</h3>
                                        <p class="text-white/80 text-sm mt-1">AIエージェントと会話してテスト</p>
                                    </div>
                                    <svg class="w-6 h-6 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </NuxtLink>

                        <!-- Menu Grid -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <NuxtLink
                                v-for="item in menu_items"
                                :key="item.to"
                                :to="item.to"
                                class="group"
                            >
                                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all h-full">
                                    <div class="flex items-start gap-4">
                                        <div class="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors">
                                            <svg v-if="item.icon === 'upload'" class="w-5 h-5 text-zinc-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <svg v-else-if="item.icon === 'link'" class="w-5 h-5 text-zinc-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                            <svg v-else-if="item.icon === 'image'" class="w-5 h-5 text-zinc-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <svg v-else-if="item.icon === 'user'" class="w-5 h-5 text-zinc-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <svg v-else-if="item.icon === 'message'" class="w-5 h-5 text-zinc-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                            </svg>
                                        </div>
                                        <div class="flex-1">
                                            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                                {{ item.title }}
                                            </h3>
                                            <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                                {{ item.description }}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </NuxtLink>
                        </div>
                    </div>

                    <!-- 未設定時 -->
                    <div v-else class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                        <div class="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">Get Started</h3>
                        <p class="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                            左側のフォームでアーティスト名とバケット名を設定すると、各機能が利用できます
                        </p>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
