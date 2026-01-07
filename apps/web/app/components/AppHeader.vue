<script setup lang="ts">
interface Props {
    title: string
    description?: string
    backTo?: string
    backLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
    backLabel: "Dashboard"
})

const auth = useAuth()
</script>

<template>
    <header class="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div class="max-w-screen-2xl mx-auto px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <!-- 左側: ロゴとナビゲーション -->
                <div class="flex items-center gap-6">
                    <NuxtLink to="/dashboard" class="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        <div class="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span class="text-white font-bold text-sm">eG</span>
                        </div>
                        <span class="font-semibold hidden sm:inline">ego Graphica</span>
                    </NuxtLink>

                    <!-- パンくずリスト -->
                    <nav class="hidden md:flex items-center gap-2 text-sm">
                        <NuxtLink
                            v-if="backTo"
                            :to="backTo"
                            class="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        >
                            {{ backLabel }}
                        </NuxtLink>
                        <span v-if="backTo" class="text-zinc-300 dark:text-zinc-600">/</span>
                        <span class="text-zinc-900 dark:text-zinc-100 font-medium">{{ title }}</span>
                    </nav>
                </div>

                <!-- 右側: ユーザー情報 -->
                <div class="flex items-center gap-4">
                    <div v-if="auth.is_configured.value" class="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                        <div class="w-2 h-2 bg-emerald-500 rounded-full" />
                        <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">{{ auth.bucket.value }}</span>
                    </div>
                </div>
            </div>
        </div>
    </header>
</template>
