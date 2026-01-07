<script setup lang="ts">
definePageMeta({
    layout: "default"
})

const router = useRouter()

onMounted(() => {
    router.replace("/dashboard")
})
</script>

<template>
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span class="text-white font-bold text-2xl">eG</span>
            </div>
            <p class="text-zinc-500 dark:text-zinc-400">Loading...</p>
        </div>
    </div>
</template>
