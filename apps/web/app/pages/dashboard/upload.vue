<script setup lang="ts">
import { ref } from "vue"

definePageMeta({
    layout: "dashboard"
})

const config = useRuntimeConfig()
const auth = useAuth()

interface FileItem {
    id: string
    filename: string
    filetype: string
}

const files = ref<File[]>([])
const uploaded_files = ref<FileItem[]>([])
const is_uploading = ref(false)
const is_fetching = ref(false)
const message = ref("")
const message_type = ref<"success" | "error">("success")

async function fetchFiles() {
    if (!auth.bucket.value) return

    is_fetching.value = true
    try {
        const response = await $fetch<{ data: { files: FileItem[] } }>(
            `${config.public.apiUrl}/api/ingest/files?bucket=${auth.bucket.value}`,
            {
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": auth.bucket.value
                }
            }
        )
        uploaded_files.value = response.data.files
    } catch (e) {
        console.error("Failed to fetch files:", e)
    } finally {
        is_fetching.value = false
    }
}

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

function removeFile(index: number) {
    files.value.splice(index, 1)
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
        message.value = `${files.value.length} file(s) uploaded`
        files.value = []

        const input = document.getElementById("file-input") as HTMLInputElement
        if (input) input.value = ""

        await fetchFiles()
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "Upload failed"
    } finally {
        is_uploading.value = false
    }
}

onMounted(() => {
    auth.initializeFromStorage()
    if (auth.bucket.value) {
        fetchFiles()
    }
})

watch(() => auth.bucket.value, (newBucket) => {
    if (newBucket) {
        fetchFiles()
    }
})
</script>

<template>
    <div class="p-6">
        <!-- Header -->
        <div class="mb-4">
            <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Upload</h1>
            <p class="text-sm text-zinc-500">Upload files for AI analysis</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            <!-- Upload Card -->
            <div class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">File Upload</h2>
                    <p class="text-xs text-zinc-500 mt-0.5">PDF, JPG, PNG, MP3, M4A, WAV, MP4</p>
                </div>

                <div class="p-4 space-y-4">
                    <!-- Drop Zone -->
                    <div
                        @drop="handleDrop"
                        @dragover="handleDragOver"
                        class="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
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
                            <svg class="w-8 h-8 text-zinc-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p class="text-sm text-zinc-600 dark:text-zinc-400">
                                Drop files or <span class="text-zinc-900 dark:text-zinc-100 font-medium">browse</span>
                            </p>
                        </label>
                    </div>

                    <!-- File List -->
                    <div v-if="files.length > 0" class="space-y-1">
                        <div
                            v-for="(file, index) in files"
                            :key="file.name"
                            class="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded text-sm"
                        >
                            <span class="flex-1 truncate text-zinc-700 dark:text-zinc-300">{{ file.name }}</span>
                            <span class="text-xs text-zinc-400">{{ (file.size / 1024 / 1024).toFixed(1) }}MB</span>
                            <button @click="removeFile(index)" class="text-zinc-400 hover:text-zinc-600">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Upload Button -->
                    <button
                        @click="handleUpload"
                        :disabled="files.length === 0 || is_uploading || !auth.is_configured.value"
                        class="w-full px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white dark:text-zinc-900 disabled:text-zinc-400 rounded text-sm font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <svg v-if="is_uploading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {{ is_uploading ? 'Uploading...' : 'Upload' }}
                    </button>

                    <!-- Message -->
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
                </div>
            </div>

            <!-- Uploaded Files List -->
            <div class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Uploaded Files</h2>
                    <span class="text-xs text-zinc-400">{{ uploaded_files.length }}</span>
                </div>

                <div class="p-4">
                    <div v-if="is_fetching" class="flex items-center justify-center py-8">
                        <div class="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    </div>

                    <div v-else-if="uploaded_files.length === 0" class="py-8 text-center">
                        <p class="text-sm text-zinc-400">No files uploaded yet</p>
                    </div>

                    <div v-else class="space-y-1 max-h-80 overflow-y-auto">
                        <div
                            v-for="file in uploaded_files"
                            :key="file.id"
                            class="flex items-center gap-2 p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                            <div class="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center flex-shrink-0">
                                <span class="text-[10px] font-medium text-zinc-500 uppercase">{{ file.filetype }}</span>
                            </div>
                            <span class="text-sm text-zinc-700 dark:text-zinc-300 truncate">{{ file.filename }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
