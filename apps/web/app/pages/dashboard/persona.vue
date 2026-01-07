<script setup lang="ts">
import { ref } from "vue"
import { AIProvider } from "@egographica/shared"

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
    provider: AIProvider.CLAUDE_SONNET as string
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
            form.value.provider = p.provider || AIProvider.CLAUDE_SONNET

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
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AppHeader title="Persona" back-to="/dashboard" />

        <main class="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8">
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Persona Settings</h1>
                <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    AIエージェントのキャラクターと話し方を定義します
                </p>
            </div>

            <div class="max-w-2xl">
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                                <svg class="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 class="font-semibold text-zinc-900 dark:text-zinc-100">Agent Persona</h2>
                                <p class="text-xs text-zinc-500">Define character and behavior</p>
                            </div>
                        </div>
                    </div>

                    <div class="p-6 space-y-6">
                        <!-- AI Model Selection -->
                        <div class="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
                            <label class="block text-sm font-medium text-violet-900 dark:text-violet-100 mb-2">
                                AI Model
                            </label>
                            <select
                                v-model="form.provider"
                                class="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-violet-200 dark:border-violet-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            >
                                <option :value="AIProvider.CLAUDE_SONNET">Claude Sonnet 4.5 (推奨・高速)</option>
                                <option :value="AIProvider.CLAUDE_OPUS">Claude Opus 4.5 (最高品質)</option>
                            </select>
                            <p class="mt-2 text-xs text-violet-600 dark:text-violet-400">
                                Sonnet: 高速で実用的な応答。Opus: より高品質だが低速・高コスト。
                            </p>
                        </div>

                        <div class="border-t border-zinc-200 dark:border-zinc-700" />

                        <!-- Character Name -->
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Character Name <span class="text-zinc-400">(optional)</span>
                            </label>
                            <input
                                v-model="form.character"
                                type="text"
                                placeholder="例: アートくん"
                                class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <!-- Motif -->
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Motif <span class="text-red-500">*</span>
                            </label>
                            <input
                                v-model="form.motif"
                                type="text"
                                placeholder="例: カエル、猫、宇宙人"
                                class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <!-- Philosophy -->
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Creative Philosophy
                            </label>
                            <textarea
                                v-model="form.philosophy"
                                placeholder="あなたの創作に対する考え方や信念"
                                rows="3"
                                class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                            />
                        </div>

                        <!-- Influences -->
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Influences
                            </label>
                            <textarea
                                v-model="form.influences"
                                placeholder="カンマ区切りで入力（例: 岡本太郎, バスキア, 日本の伝統文化）"
                                rows="2"
                                class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                            />
                        </div>

                        <!-- Avoidances -->
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Topics to Avoid
                            </label>
                            <textarea
                                v-model="form.avoidances"
                                placeholder="カンマ区切りで入力（例: 政治, 宗教批判）"
                                rows="2"
                                class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                            />
                        </div>

                        <div class="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                            <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Sample Response</h3>

                            <div class="space-y-4">
                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Situation</label>
                                    <input
                                        v-model="form.sample_situation"
                                        type="text"
                                        placeholder="例: 顧客が作品の価格について質問したとき"
                                        class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Customer Message</label>
                                    <input
                                        v-model="form.sample_message"
                                        type="text"
                                        placeholder="例: この絵はいくらですか？"
                                        class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Ideal Response</label>
                                    <textarea
                                        v-model="form.sample_response"
                                        placeholder="例: ご興味いただきありがとうございます！..."
                                        rows="3"
                                        class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            @click="handleSubmit"
                            :disabled="!form.motif || is_loading || !auth.is_configured.value"
                            class="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <svg v-if="is_loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {{ is_loading ? 'Saving...' : 'Save Persona' }}
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
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
