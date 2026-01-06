<script setup lang="ts">
import { ref } from "vue"

definePageMeta({
    layout: "default"
})

const config = useRuntimeConfig()
const auth = useAuth()

const form = ref({
    character: "",
    motif: "",
    philosophy: "",
    influences: "",
    avoidances: "",
    sample_situation: "",
    sample_message: "",
    sample_response: "",
    provider: "claude"
})

const is_loading = ref(false)
const is_fetching = ref(false)
const message = ref("")
const message_type = ref<"success" | "error">("success")

async function fetchPersona() {
    if (!auth.bucket.value) return

    is_fetching.value = true
    try {
        const response = await $fetch<{ data: { persona: any } }>(
            `${config.public.apiUrl}/api/persona?bucket=${auth.bucket.value}`,
            {
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": auth.bucket.value
                }
            }
        )

        if (response.data.persona) {
            const p = response.data.persona
            form.value.character = p.character || ""
            form.value.motif = p.motif || ""
            form.value.philosophy = p.philosophy || ""
            form.value.influences = (p.influences || []).join(", ")
            form.value.avoidances = (p.avoidances || []).join(", ")
            form.value.provider = p.provider || "claude"

            if (p.samples && p.samples.length > 0) {
                form.value.sample_situation = p.samples[0].situation || ""
                form.value.sample_message = p.samples[0].message || ""
                form.value.sample_response = p.samples[0].response || ""
            }
        }
    } catch (e) {
        console.error("Failed to fetch persona:", e)
    } finally {
        is_fetching.value = false
    }
}

async function handleSubmit() {
    if (!form.value.motif || !auth.bucket.value) return

    is_loading.value = true
    message.value = ""

    try {
        const samples = []
        if (form.value.sample_situation && form.value.sample_message && form.value.sample_response) {
            samples.push({
                situation: form.value.sample_situation,
                message: form.value.sample_message,
                response: form.value.sample_response
            })
        }

        await $fetch(`${config.public.apiUrl}/api/persona`, {
            method: "PUT",
            headers: {
                "X-API-Key": config.public.masterApiKey,
                "X-Bucket": auth.bucket.value
            },
            body: {
                bucket: auth.bucket.value,
                character: form.value.character || undefined,
                motif: form.value.motif,
                philosophy: form.value.philosophy,
                influences: form.value.influences.split(",").map(s => s.trim()).filter(Boolean),
                avoidances: form.value.avoidances.split(",").map(s => s.trim()).filter(Boolean),
                samples,
                provider: form.value.provider
            }
        })

        message_type.value = "success"
        message.value = "ペルソナ設定を保存しました"
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "保存に失敗しました"
    } finally {
        is_loading.value = false
    }
}

onMounted(() => {
    auth.initializeFromStorage()
    if (auth.bucket.value) {
        fetchPersona()
    }
})

watch(() => auth.bucket.value, (newBucket) => {
    if (newBucket) {
        fetchPersona()
    }
})
</script>

<template>
    <div class="container mx-auto py-8">
        <div class="space-y-6">
            <div class="flex items-center gap-4">
                <NuxtLink to="/dashboard">
                    <UiButton variant="ghost" size="sm">← 戻る</UiButton>
                </NuxtLink>
                <h1 class="text-3xl font-bold">ペルソナ設定</h1>
            </div>

            <UiCard>
                <UiCardHeader>
                    <UiCardTitle>エージェントの性格を定義</UiCardTitle>
                    <UiCardDescription>
                        AIエージェントがどのように振る舞うかを設定します
                    </UiCardDescription>
                </UiCardHeader>
                <UiCardContent>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <UiLabel for="provider">AIプロバイダー</UiLabel>
                            <select
                                id="provider"
                                v-model="form.provider"
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="claude">Claude Opus 4.5 (高品質・Tool Calling対応)</option>
                                <option value="gpt-4o-mini">GPT-4o-mini (高速・低コスト)</option>
                            </select>
                            <p class="text-xs text-muted-foreground">
                                Claude Opus: 高品質な応答。GPT-4o-mini: 高速応答・低コスト。どちらもTool Calling対応。
                            </p>
                        </div>

                        <div class="border-t pt-4"></div>

                        <div class="space-y-2">
                            <UiLabel for="character">キャラクター名（任意）</UiLabel>
                            <UiInput
                                id="character"
                                v-model="form.character"
                                placeholder="例: アートくん"
                            />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="motif">モチーフ</UiLabel>
                            <UiInput
                                id="motif"
                                v-model="form.motif"
                                placeholder="例: カエル、猫、宇宙人"
                            />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="philosophy">創作哲学</UiLabel>
                            <textarea
                                id="philosophy"
                                v-model="form.philosophy"
                                placeholder="あなたの創作に対する考え方や信念"
                                rows="3"
                                class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="influences">影響を受けた作家・文化</UiLabel>
                            <textarea
                                id="influences"
                                v-model="form.influences"
                                placeholder="カンマ区切りで入力（例: 岡本太郎, バスキア, 日本の伝統文化）"
                                rows="2"
                                class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="avoidances">避けるべきトピック</UiLabel>
                            <textarea
                                id="avoidances"
                                v-model="form.avoidances"
                                placeholder="カンマ区切りで入力（例: 政治, 宗教批判）"
                                rows="2"
                                class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                        </div>

                        <div class="border-t pt-4 space-y-4">
                            <h3 class="font-medium">理想的な応答例</h3>

                            <div class="space-y-2">
                                <UiLabel for="sample_situation">状況説明</UiLabel>
                                <UiInput
                                    id="sample_situation"
                                    v-model="form.sample_situation"
                                    placeholder="例: 顧客が作品の価格について質問したとき"
                                />
                            </div>

                            <div class="space-y-2">
                                <UiLabel for="sample_message">顧客の発言例</UiLabel>
                                <UiInput
                                    id="sample_message"
                                    v-model="form.sample_message"
                                    placeholder="例: この絵はいくらですか？"
                                />
                            </div>

                            <div class="space-y-2">
                                <UiLabel for="sample_response">理想的な応答</UiLabel>
                                <textarea
                                    id="sample_response"
                                    v-model="form.sample_response"
                                    placeholder="例: ご興味いただきありがとうございます！..."
                                    rows="3"
                                    class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        <UiButton
                            @click="handleSubmit"
                            :disabled="!form.motif || is_loading || !auth.is_configured.value"
                            :loading="is_loading"
                        >
                            保存
                        </UiButton>

                        <UiAlert v-if="message" :variant="message_type === 'error' ? 'destructive' : 'default'">
                            {{ message }}
                        </UiAlert>
                    </div>
                </UiCardContent>
            </UiCard>
        </div>
    </div>
</template>
