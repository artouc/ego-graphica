<script setup lang="ts">
import { ref } from "vue"

definePageMeta({
    layout: "dashboard"
})

const config = useRuntimeConfig()
const auth = useAuth()

interface ImageAnalysis {
    colors: string[]
    colormood: string
    composition: string
    style: string
    technique: string
    subject: string
    elements: string[]
    mood: string
    narrative: string
    tags: string[]
    searchable: string
}

interface AssetItem {
    id: string
    url: string
    filename: string
    mimetype: string
    source: "uploaded" | "pdf-extracted"
    source_file_id?: string
    source_filename?: string
    page_number?: number
    analysis: ImageAnalysis
    created: Date
}

const assets = ref<AssetItem[]>([])
const is_fetching = ref(false)
const selected_asset = ref<AssetItem | null>(null)

async function fetchAssets() {
    if (!auth.bucket.value) return

    is_fetching.value = true
    try {
        const response = await $fetch<{ data: { assets: AssetItem[] } }>(
            `${config.public.apiUrl}/api/assets?bucket=${auth.bucket.value}`,
            {
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": auth.bucket.value
                }
            }
        )
        assets.value = response.data.assets
    } catch (e) {
        console.error("Failed to fetch assets:", e)
    } finally {
        is_fetching.value = false
    }
}

function selectAsset(asset: AssetItem) {
    selected_asset.value = asset
}

function closeDetail() {
    selected_asset.value = null
}

onMounted(() => {
    auth.initializeFromStorage()
    if (auth.bucket.value) {
        fetchAssets()
    }
})

watch(() => auth.bucket.value, (newBucket) => {
    if (newBucket) {
        fetchAssets()
    }
})
</script>

<template>
    <div class="p-6 h-full flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="mb-4 flex-shrink-0">
            <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Assets</h1>
            <p class="text-sm text-zinc-500">Images analyzed by Claude Vision</p>
        </div>

        <div class="flex-1 flex gap-6 min-h-0">
            <!-- Assets Grid -->
            <div class="flex-1 overflow-y-auto">
                <div v-if="is_fetching" class="flex items-center justify-center py-12">
                    <div class="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                </div>

                <div v-else-if="assets.length === 0" class="flex items-center justify-center py-12">
                    <div class="text-center">
                        <svg class="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p class="text-sm text-zinc-400">No assets yet</p>
                        <p class="text-xs text-zinc-400 mt-1">Upload images or PDFs to get started</p>
                    </div>
                </div>

                <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    <div
                        v-for="asset in assets"
                        :key="asset.id"
                        @click="selectAsset(asset)"
                        :class="[
                            'group relative aspect-square rounded-lg overflow-hidden cursor-pointer border transition-all',
                            selected_asset?.id === asset.id
                                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                        ]"
                    >
                        <img
                            :src="asset.url"
                            :alt="asset.filename"
                            class="w-full h-full object-cover"
                        />
                        <!-- Overlay -->
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div class="absolute bottom-0 left-0 right-0 p-2">
                                <p class="text-xs text-white truncate">{{ asset.analysis?.subject || asset.filename }}</p>
                                <div class="flex items-center gap-1 mt-0.5">
                                    <span
                                        :class="[
                                            'text-[9px] px-1 py-0.5 rounded',
                                            asset.source === 'pdf-extracted'
                                                ? 'bg-blue-500/80 text-white'
                                                : 'bg-emerald-500/80 text-white'
                                        ]"
                                    >
                                        {{ asset.source === 'pdf-extracted' ? 'PDF' : 'Upload' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Detail Panel -->
            <div
                v-if="selected_asset"
                class="w-80 flex-shrink-0 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
            >
                <!-- Image Preview -->
                <div class="aspect-square bg-zinc-100 dark:bg-zinc-800 relative">
                    <img
                        :src="selected_asset.url"
                        :alt="selected_asset.filename"
                        class="w-full h-full object-contain"
                    />
                    <button
                        @click="closeDetail"
                        class="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Analysis -->
                <div class="flex-1 overflow-y-auto p-4 space-y-3">
                    <!-- Subject -->
                    <div>
                        <h3 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {{ selected_asset.analysis?.subject || 'Unknown' }}
                        </h3>
                        <p class="text-xs text-zinc-500 mt-0.5">{{ selected_asset.filename }}</p>
                    </div>

                    <!-- Source Info -->
                    <div class="flex items-center gap-2">
                        <span
                            :class="[
                                'text-[10px] px-1.5 py-0.5 rounded',
                                selected_asset.source === 'pdf-extracted'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            ]"
                        >
                            {{ selected_asset.source === 'pdf-extracted' ? 'PDF Extracted' : 'Uploaded' }}
                        </span>
                        <span v-if="selected_asset.source_filename" class="text-[10px] text-zinc-400">
                            from {{ selected_asset.source_filename }}
                        </span>
                    </div>

                    <!-- Description -->
                    <div v-if="selected_asset.analysis?.searchable" class="space-y-1">
                        <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Description</label>
                        <p class="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            {{ selected_asset.analysis.searchable }}
                        </p>
                    </div>

                    <!-- Style & Technique -->
                    <div v-if="selected_asset.analysis?.style || selected_asset.analysis?.technique" class="grid grid-cols-2 gap-2">
                        <div v-if="selected_asset.analysis?.style">
                            <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Style</label>
                            <p class="text-xs text-zinc-700 dark:text-zinc-300">{{ selected_asset.analysis.style }}</p>
                        </div>
                        <div v-if="selected_asset.analysis?.technique">
                            <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Technique</label>
                            <p class="text-xs text-zinc-700 dark:text-zinc-300">{{ selected_asset.analysis.technique }}</p>
                        </div>
                    </div>

                    <!-- Mood & Composition -->
                    <div v-if="selected_asset.analysis?.mood || selected_asset.analysis?.composition" class="grid grid-cols-2 gap-2">
                        <div v-if="selected_asset.analysis?.mood">
                            <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Mood</label>
                            <p class="text-xs text-zinc-700 dark:text-zinc-300">{{ selected_asset.analysis.mood }}</p>
                        </div>
                        <div v-if="selected_asset.analysis?.composition">
                            <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Composition</label>
                            <p class="text-xs text-zinc-700 dark:text-zinc-300">{{ selected_asset.analysis.composition }}</p>
                        </div>
                    </div>

                    <!-- Colors -->
                    <div v-if="selected_asset.analysis?.colors?.length">
                        <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Colors</label>
                        <div class="flex flex-wrap gap-1">
                            <span
                                v-for="color in selected_asset.analysis.colors"
                                :key="color"
                                class="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400"
                            >
                                {{ color }}
                            </span>
                        </div>
                    </div>

                    <!-- Elements -->
                    <div v-if="selected_asset.analysis?.elements?.length">
                        <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Elements</label>
                        <div class="flex flex-wrap gap-1">
                            <span
                                v-for="element in selected_asset.analysis.elements"
                                :key="element"
                                class="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400"
                            >
                                {{ element }}
                            </span>
                        </div>
                    </div>

                    <!-- Tags -->
                    <div v-if="selected_asset.analysis?.tags?.length">
                        <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Tags</label>
                        <div class="flex flex-wrap gap-1">
                            <span
                                v-for="tag in selected_asset.analysis.tags"
                                :key="tag"
                                class="text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded text-emerald-600 dark:text-emerald-400"
                            >
                                #{{ tag }}
                            </span>
                        </div>
                    </div>

                    <!-- Narrative -->
                    <div v-if="selected_asset.analysis?.narrative">
                        <label class="block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Narrative</label>
                        <p class="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            {{ selected_asset.analysis.narrative }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
