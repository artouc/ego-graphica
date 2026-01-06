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
                body: formData
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
    <div class="container mx-auto py-8">
        <div class="space-y-6">
            <div class="flex items-center gap-4">
                <NuxtLink to="/dashboard">
                    <UiButton variant="ghost" size="sm">← 戻る</UiButton>
                </NuxtLink>
                <h1 class="text-3xl font-bold">ファイルアップロード</h1>
            </div>

            <UiCard>
                <UiCardHeader>
                    <UiCardTitle>ファイルを選択</UiCardTitle>
                    <UiCardDescription>
                        PDF、画像（JPG、PNG）、音声（MP3、M4A、WAV）、動画（MP4）をアップロードできます
                    </UiCardDescription>
                </UiCardHeader>
                <UiCardContent>
                    <div class="space-y-4">
                        <div class="border-2 border-dashed border-input rounded-lg p-8 text-center">
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.mp3,.m4a,.wav,.mp4"
                                class="hidden"
                                id="file-input"
                                @change="handleFileChange"
                            />
                            <label
                                for="file-input"
                                class="cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                                <p class="text-lg mb-2">クリックしてファイルを選択</p>
                                <p class="text-sm">または、ここにドラッグ＆ドロップ</p>
                            </label>
                        </div>

                        <div v-if="files.length > 0" class="space-y-2">
                            <p class="text-sm font-medium">選択されたファイル:</p>
                            <ul class="text-sm text-muted-foreground space-y-1">
                                <li v-for="file in files" :key="file.name">
                                    {{ file.name }} ({{ (file.size / 1024 / 1024).toFixed(2) }} MB)
                                </li>
                            </ul>
                        </div>

                        <UiButton
                            @click="handleUpload"
                            :disabled="files.length === 0 || is_uploading || !auth.is_configured.value"
                            :loading="is_uploading"
                        >
                            アップロード
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
