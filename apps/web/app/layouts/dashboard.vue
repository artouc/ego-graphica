<script setup lang="ts">
const route = useRoute()
const auth = useAuth()

const nav_items = [
    { to: "/dashboard", label: "Overview", icon: "home" },
    { to: "/dashboard/works", label: "Works", icon: "image" },
    { to: "/dashboard/upload", label: "Upload", icon: "upload" },
    { to: "/dashboard/url", label: "URL Import", icon: "link" },
    { to: "/dashboard/persona", label: "Persona", icon: "user" },
    // { to: "/dashboard/hearing", label: "Hearing", icon: "message" }
]

function isActive(path: string) {
    if (path === "/dashboard") {
        return route.path === "/dashboard"
    }
    return route.path.startsWith(path)
}

onMounted(() => {
    auth.initializeFromStorage()
})
</script>

<template>
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
        <!-- Sidebar -->
        <aside class="w-56 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed h-full">
            <!-- Logo -->
            <div class="h-12 flex items-center px-4 border-b border-zinc-100 dark:border-zinc-800">
                <NuxtLink to="/dashboard" class="flex items-center gap-2">
                    <div class="w-6 h-6 bg-zinc-900 dark:bg-zinc-100 rounded flex items-center justify-center">
                        <span class="text-white dark:text-zinc-900 font-semibold text-xs">eG</span>
                    </div>
                    <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">ego Graphica</span>
                </NuxtLink>
            </div>

            <!-- Navigation -->
            <nav class="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
                <NuxtLink
                    v-for="item in nav_items"
                    :key="item.to"
                    :to="item.to"
                    :class="[
                        'flex items-center gap-2 px-2.5 py-1.5 rounded text-sm transition-colors',
                        isActive(item.to)
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
                    ]"
                >
                    <svg v-if="item.icon === 'home'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <svg v-else-if="item.icon === 'image'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <svg v-else-if="item.icon === 'upload'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <svg v-else-if="item.icon === 'link'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <svg v-else-if="item.icon === 'user'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <svg v-else-if="item.icon === 'message'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    {{ item.label }}
                </NuxtLink>

                <!-- ego Graphica -->
                <NuxtLink
                    v-if="auth.is_configured.value"
                    :to="`/agent/${auth.bucket.value}`"
                    :class="[
                        'flex items-center gap-2 px-2.5 py-1.5 rounded text-sm transition-colors',
                        route.path.startsWith('/agent')
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400'
                    ]"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    ego Graphica
                </NuxtLink>
            </nav>

            <!-- User Info -->
            <div class="p-3 border-t border-zinc-100 dark:border-zinc-800">
                <div v-if="auth.is_configured.value" class="flex items-center gap-2">
                    <div class="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                        <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">{{ auth.artist_name.value?.charAt(0) }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{{ auth.artist_name.value }}</p>
                        <p class="text-[10px] text-zinc-500 truncate">{{ auth.bucket.value }}</p>
                    </div>
                </div>
                <div v-else class="text-xs text-zinc-500">
                    Not configured
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 ml-56">
            <slot />
        </main>
    </div>
</template>
