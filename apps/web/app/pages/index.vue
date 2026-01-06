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
    <div class="flex min-h-screen items-center justify-center">
        <p class="text-muted-foreground">読み込み中...</p>
    </div>
</template>
