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
            <div class="w-10 h-10 bg-zinc-900 dark:bg-zinc-100 rounded flex items-center justify-center mx-auto mb-3">
                <span class="text-white dark:text-zinc-900 font-semibold text-sm">eG</span>
            </div>
            <div class="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin mx-auto" />
        </div>
    </div>
</template>
