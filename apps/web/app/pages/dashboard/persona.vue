<script setup lang="ts">
import { ref } from "vue"
import { AIProvider } from "@egographica/shared"

definePageMeta({
    layout: "dashboard"
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
        message.value = "Saved"
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "Failed to save"
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
    <div class="p-6">
        <!-- Header -->
        <div class="mb-4">
            <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Persona</h1>
            <p class="text-sm text-zinc-500">Define agent character and behavior</p>
        </div>

        <div class="max-w-xl">
            <div class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Settings</h2>
                </div>

                <div class="p-4 space-y-4">
                    <!-- Model -->
                    <div class="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-1.5">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">AI Model</label>
                        <select
                            v-model="form.provider"
                            class="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        >
                            <option :value="AIProvider.CLAUDE_SONNET">Claude Sonnet 4.5 (Fast)</option>
                            <option :value="AIProvider.CLAUDE_OPUS">Claude Opus 4.5 (Best)</option>
                        </select>
                    </div>

                    <div class="border-t border-zinc-100 dark:border-zinc-800" />

                    <!-- Character -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Character Name <span class="text-zinc-400">(optional)</span>
                        </label>
                        <input
                            v-model="form.character"
                            type="text"
                            placeholder="e.g. Art-kun"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                    </div>

                    <!-- Motif -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Motif <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="form.motif"
                            type="text"
                            placeholder="e.g. Frog, Cat, Alien"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                    </div>

                    <!-- Philosophy -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Philosophy</label>
                        <textarea
                            v-model="form.philosophy"
                            placeholder="Your creative philosophy"
                            rows="2"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                        />
                    </div>

                    <!-- Influences -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Influences</label>
                        <input
                            v-model="form.influences"
                            type="text"
                            placeholder="Comma-separated (e.g. Basquiat, Japanese culture)"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                    </div>

                    <!-- Avoidances -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Topics to Avoid</label>
                        <input
                            v-model="form.avoidances"
                            type="text"
                            placeholder="Comma-separated (e.g. politics, religion)"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                    </div>

                    <div class="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                        <h3 class="text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-3">Sample Response</h3>

                        <div class="space-y-3">
                            <div class="space-y-1">
                                <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Situation</label>
                                <input
                                    v-model="form.sample_situation"
                                    type="text"
                                    placeholder="When a customer asks about pricing"
                                    class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                />
                            </div>

                            <div class="space-y-1">
                                <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Customer Message</label>
                                <input
                                    v-model="form.sample_message"
                                    type="text"
                                    placeholder="How much is this painting?"
                                    class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                />
                            </div>

                            <div class="space-y-1">
                                <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Ideal Response</label>
                                <textarea
                                    v-model="form.sample_response"
                                    placeholder="Thank you for your interest!..."
                                    rows="2"
                                    class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        @click="handleSubmit"
                        :disabled="!form.motif || is_loading || !auth.is_configured.value"
                        class="w-full px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white dark:text-zinc-900 disabled:text-zinc-400 rounded text-sm font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <svg v-if="is_loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {{ is_loading ? 'Saving...' : 'Save' }}
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
                </div>
            </div>
        </div>
    </div>
</template>
