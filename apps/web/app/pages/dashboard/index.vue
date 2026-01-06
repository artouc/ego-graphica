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
</script>

<template>
    <div class="container mx-auto py-8">
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h1 class="text-3xl font-bold">ダッシュボード</h1>
            </div>

            <!-- 設定フォーム -->
            <UiCard>
                <UiCardHeader>
                    <UiCardTitle>アーティスト設定</UiCardTitle>
                    <UiCardDescription>
                        アーティスト名とバケット名を設定してください
                    </UiCardDescription>
                </UiCardHeader>
                <UiCardContent>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <UiLabel for="name">アーティスト名</UiLabel>
                            <UiInput
                                id="name"
                                v-model="form.name"
                                placeholder="アーティスト名を入力"
                            />
                        </div>

                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <UiLabel for="bucket">バケット名</UiLabel>
                                <label class="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        v-model="auto_bucket"
                                        class="rounded border-input"
                                    />
                                    自動生成
                                </label>
                            </div>
                            <UiInput
                                id="bucket"
                                v-model="form.bucket"
                                :placeholder="auto_bucket ? generated_bucket : 'バケット名を入力'"
                                :disabled="auto_bucket"
                            />
                            <p class="text-xs text-muted-foreground">
                                リソースの一意識別子（英小文字、数字、ハイフンのみ）
                            </p>
                        </div>

                        <div class="flex gap-2">
                            <UiButton
                                @click="handleSave"
                                :disabled="!form.name || !actual_bucket"
                            >
                                保存
                            </UiButton>
                            <UiButton
                                variant="outline"
                                @click="handleReset"
                                v-if="auth.is_configured.value"
                            >
                                リセット
                            </UiButton>
                        </div>

                        <div v-if="auth.is_configured.value" class="text-sm text-muted-foreground pt-2 border-t">
                            <p>現在の設定: <strong>{{ auth.artist_name.value }}</strong> ({{ auth.bucket.value }})</p>
                        </div>
                    </div>
                </UiCardContent>
            </UiCard>

            <!-- 機能メニュー -->
            <div v-if="auth.is_configured.value" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <NuxtLink to="/dashboard/upload">
                    <UiCard class="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <UiCardHeader>
                            <UiCardTitle>ファイルアップロード</UiCardTitle>
                            <UiCardDescription>
                                PDF、画像、音声ファイルをアップロードしてAI解析
                            </UiCardDescription>
                        </UiCardHeader>
                    </UiCard>
                </NuxtLink>

                <NuxtLink to="/dashboard/url">
                    <UiCard class="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <UiCardHeader>
                            <UiCardTitle>URL追加</UiCardTitle>
                            <UiCardDescription>
                                Webコンテンツをスクレイピングして解析
                            </UiCardDescription>
                        </UiCardHeader>
                    </UiCard>
                </NuxtLink>

                <NuxtLink to="/dashboard/works">
                    <UiCard class="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <UiCardHeader>
                            <UiCardTitle>作品管理</UiCardTitle>
                            <UiCardDescription>
                                作品ポートフォリオの追加・整理
                            </UiCardDescription>
                        </UiCardHeader>
                    </UiCard>
                </NuxtLink>

                <NuxtLink to="/dashboard/persona">
                    <UiCard class="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <UiCardHeader>
                            <UiCardTitle>ペルソナ設定</UiCardTitle>
                            <UiCardDescription>
                                エージェントのキャラクターと話し方を定義
                            </UiCardDescription>
                        </UiCardHeader>
                    </UiCard>
                </NuxtLink>

                <NuxtLink to="/dashboard/hearing">
                    <UiCard class="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <UiCardHeader>
                            <UiCardTitle>ヒアリング</UiCardTitle>
                            <UiCardDescription>
                                エージェント改善のためのフィードバック
                            </UiCardDescription>
                        </UiCardHeader>
                    </UiCard>
                </NuxtLink>

                <NuxtLink :to="`/agent/${auth.bucket.value}`">
                    <UiCard class="hover:shadow-md transition-shadow cursor-pointer h-full bg-primary text-primary-foreground">
                        <UiCardHeader>
                            <UiCardTitle>エージェントテスト</UiCardTitle>
                            <UiCardDescription class="text-primary-foreground/80">
                                AIエージェントと会話する
                            </UiCardDescription>
                        </UiCardHeader>
                    </UiCard>
                </NuxtLink>
            </div>

            <!-- 未設定時のメッセージ -->
            <div v-else class="text-center py-8 text-muted-foreground">
                <p>アーティスト名とバケット名を設定すると、各機能が利用できます</p>
            </div>
        </div>
    </div>
</template>
