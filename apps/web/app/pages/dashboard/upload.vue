<script setup lang="ts">
import { ref } from "vue"

definePageMeta({
    layout: "default"
})

const config = useRuntimeConfig()
const auth = useAuth()
const files = ref<File[]>([])
const is_uploading = ref(false)
const message = ref("")
const message_type = ref<"success" | "error">("success")

function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files) {
        files.value = Array.from(target.files)
    }
}

function handleDrop(event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer?.files) {
        files.value = Array.from(event.dataTransfer.files)
    }
}

function handleDragOver(event: DragEvent) {
    event.preventDefault()
}

async function handleUpload() {
    if (files.value.length === 0 || !auth.bucket.value) return

    is_uploading.value = true
    message.value = ""

    try {
        for (const file of files.value) {
            const formData = new FormData()
            formData.append("bucket", auth.bucket.value)
            formData.append("file", file)

            await $fetch(`${config.public.apiUrl}/api/ingest/file`, {
                method: "POST",
                body: formData,
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": auth.bucket.value
                }
            })
        }

        message_type.value = "success"
        message.value = `${files.value.length}件のファイルをアップロードしました`
        files.value = []

        const input = document.getElementById("file-input") as HTMLInputElement
        if (input) input.value = ""
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "アップロードに失敗しました"
    } finally {
        is_uploading.value = false
    }
}

onMounted(() => {
    auth.initializeFromStorage()
})
</script>

<template>
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AppHeader title="File Upload" back-to="/dashboard" />

        <main class="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8">
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">File Upload</h1>
                <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    PDF、画像、音声ファイルをアップロードしてAIに学習させます
                </p>
            </div>

            <div class="max-w-2xl">
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                                <svg class="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                            <div>
                                <h2 class="font-semibold text-zinc-900 dark:text-zinc-100">Upload Files</h2>
                                <p class="text-xs text-zinc-500">PDF, JPG, PNG, MP3, M4A, WAV, MP4</p>
                            </div>
                        </div>
                    </div>

                    <div class="p-6 space-y-6">
                        <!-- ドロップゾーン -->
                        <div
                            @drop="handleDrop"
                            @dragover="handleDragOver"
                            class="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-10 text-center hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer"
                        >
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.mp3,.m4a,.wav,.mp4"
                                class="hidden"
                                id="file-input"
                                @change="handleFileChange"
                            />
                            <label for="file-input" class="cursor-pointer">
                                <div class="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg class="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <p class="text-zinc-900 dark:text-zinc-100 font-medium mb-1">
                                    Drop files here or click to browse
                                </p>
                                <p class="text-sm text-zinc-500">
                                    Maximum file size: 50MB
                                </p>
                            </label>
                        </div>

                        <!-- 選択されたファイル -->
                        <div v-if="files.length > 0" class="space-y-3">
                            <h3 class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Selected Files ({{ files.length }})
                            </h3>
                            <div class="space-y-2">
                                <div
                                    v-for="file in files"
                                    :key="file.name"
                                    class="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                                >
                                    <div class="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded flex items-center justify-center">
                                        <svg class="w-4 h-4 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm text-zinc-900 dark:text-zinc-100 truncate">{{ file.name }}</p>
                                        <p class="text-xs text-zinc-500">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- アップロードボタン -->
                        <button
                            @click="handleUpload"
                            :disabled="files.length === 0 || is_uploading || !auth.is_configured.value"
                            class="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <svg v-if="is_uploading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {{ is_uploading ? 'Uploading...' : 'Upload Files' }}
                        </button>

                        <!-- メッセージ -->
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

                        <!-- 未設定警告 -->
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
