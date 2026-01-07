<script setup lang="ts">
import { ref, computed, onMounted } from "vue"

definePageMeta({
    layout: "dashboard"
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
    <div class="p-6">
        <!-- Header -->
        <div class="mb-6">
            <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Overview</h1>
            <p class="text-sm text-zinc-500">Manage your artist settings</p>
        </div>

        <div class="max-w-lg">
            <!-- Settings Card -->
            <div class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Artist Settings</h2>
                </div>

                <div class="p-4 space-y-4">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Artist Name
                        </label>
                        <input
                            v-model="form.name"
                            type="text"
                            placeholder="Enter artist name"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all"
                        />
                    </div>

                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                Bucket ID
                            </label>
                            <label class="flex items-center gap-1.5 text-xs text-zinc-500">
                                <input
                                    type="checkbox"
                                    v-model="auto_bucket"
                                    class="rounded border-zinc-300 dark:border-zinc-600 text-zinc-600 focus:ring-zinc-400 w-3 h-3"
                                />
                                Auto
                            </label>
                        </div>
                        <input
                            v-model="form.bucket"
                            type="text"
                            :placeholder="auto_bucket ? generated_bucket || 'auto-generated' : 'Enter bucket name'"
                            :disabled="auto_bucket"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        />
                    </div>

                    <div class="flex gap-2 pt-2">
                        <button
                            @click="handleSave"
                            :disabled="!form.name || !actual_bucket"
                            class="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white dark:text-zinc-900 disabled:text-zinc-400 rounded text-sm font-medium transition-all disabled:cursor-not-allowed"
                        >
                            Save Settings
                        </button>
                        <button
                            v-if="auth.is_configured.value"
                            @click="handleReset"
                            class="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded text-sm transition-all"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            <!-- Status -->
            <div v-if="auth.is_configured.value" class="mt-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span class="text-sm text-zinc-600 dark:text-zinc-400">
                        Connected as <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ auth.artist_name.value }}</span>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
