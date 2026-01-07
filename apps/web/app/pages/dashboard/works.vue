<script setup lang="ts">
import { ref } from "vue"

definePageMeta({
    layout: "dashboard"
})

const config = useRuntimeConfig()
const auth = useAuth()

interface Work {
    id: string
    url: string
    title: string
    status: string
    date: string | null
    worktype?: string
    client?: string
    description?: string
    story?: string
}

const works = ref<Work[]>([])
const form = ref({
    file: null as File | null,
    title: "",
    date: "",
    worktype: "personal",
    client: "",
    status: "available",
    description: "",
    story: ""
})

const is_loading = ref(false)
const is_fetching = ref(false)
const is_editing = ref(false)
const message = ref("")
const message_type = ref<"success" | "error">("success")

const edit_modal_open = ref(false)
const editing_work = ref<Work | null>(null)
const edit_form = ref({
    title: "",
    date: "",
    worktype: "personal",
    client: "",
    status: "available",
    description: "",
    story: ""
})

async function fetchWorks() {
    if (!auth.bucket.value) return

    is_fetching.value = true
    try {
        const response = await $fetch<{ data: { works: Work[] } }>(
            `${config.public.apiUrl}/api/works?bucket=${auth.bucket.value}`,
            {
                headers: {
                    "X-API-Key": config.public.masterApiKey,
                    "X-Bucket": auth.bucket.value
                }
            }
        )
        works.value = response.data.works
    } catch (e) {
        console.error("Failed to fetch works:", e)
    } finally {
        is_fetching.value = false
    }
}

function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files && target.files[0]) {
        form.value.file = target.files[0]
    }
}

async function handleSubmit() {
    if (!form.value.file || !form.value.title || !auth.bucket.value) return

    is_loading.value = true
    message.value = ""

    try {
        const formData = new FormData()
        formData.append("bucket", auth.bucket.value)
        formData.append("file", form.value.file)
        formData.append("title", form.value.title)
        formData.append("date", form.value.date)
        formData.append("worktype", form.value.worktype)
        formData.append("client", form.value.client)
        formData.append("status", form.value.status)
        formData.append("description", form.value.description)
        formData.append("story", form.value.story)

        await $fetch(`${config.public.apiUrl}/api/works`, {
            method: "POST",
            headers: {
                "X-API-Key": config.public.masterApiKey,
                "X-Bucket": auth.bucket.value
            },
            body: formData
        })

        message_type.value = "success"
        message.value = `Added "${form.value.title}"`

        form.value = {
            file: null,
            title: "",
            date: "",
            worktype: "personal",
            client: "",
            status: "available",
            description: "",
            story: ""
        }

        const input = document.getElementById("work-file") as HTMLInputElement
        if (input) input.value = ""

        await fetchWorks()
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "Failed to add work"
    } finally {
        is_loading.value = false
    }
}

async function handleDelete(id: string) {
    if (!confirm("Delete this work?")) return

    try {
        await $fetch(`${config.public.apiUrl}/api/works/${id}?bucket=${auth.bucket.value}`, {
            method: "DELETE",
            headers: {
                "X-API-Key": config.public.masterApiKey,
                "X-Bucket": auth.bucket.value
            }
        })
        await fetchWorks()
    } catch (e) {
        console.error("Failed to delete work:", e)
    }
}

function openEditModal(work: Work) {
    editing_work.value = work
    edit_form.value = {
        title: work.title || "",
        date: work.date ? work.date.split("T")[0] : "",
        worktype: work.worktype || "personal",
        client: work.client || "",
        status: work.status || "available",
        description: work.description || "",
        story: work.story || ""
    }
    edit_modal_open.value = true
}

function closeEditModal() {
    edit_modal_open.value = false
    editing_work.value = null
}

async function handleEditSubmit() {
    if (!editing_work.value || !auth.bucket.value) return

    is_editing.value = true

    try {
        await $fetch(`${config.public.apiUrl}/api/works/${editing_work.value.id}`, {
            method: "PUT",
            headers: {
                "X-API-Key": config.public.masterApiKey,
                "X-Bucket": auth.bucket.value
            },
            body: {
                bucket: auth.bucket.value,
                title: edit_form.value.title,
                date: edit_form.value.date || undefined,
                worktype: edit_form.value.worktype,
                client: edit_form.value.client || undefined,
                status: edit_form.value.status,
                description: edit_form.value.description || undefined,
                story: edit_form.value.story || undefined
            }
        })

        message_type.value = "success"
        message.value = `Updated "${edit_form.value.title}"`

        closeEditModal()
        await fetchWorks()
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "Failed to update"
    } finally {
        is_editing.value = false
    }
}

const status_labels: Record<string, string> = {
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    unavailable: "Not for sale"
}

onMounted(() => {
    auth.initializeFromStorage()
    if (auth.bucket.value) {
        fetchWorks()
    }
})

watch(() => auth.bucket.value, (newBucket) => {
    if (newBucket) {
        fetchWorks()
    }
})
</script>

<template>
    <div class="p-6">
        <!-- Header -->
        <div class="mb-4">
            <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Works</h1>
            <p class="text-sm text-zinc-500">Manage your portfolio</p>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <!-- Works Grid -->
            <div class="xl:col-span-2">
                <div v-if="is_fetching" class="flex items-center justify-center py-12">
                    <div class="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                </div>

                <div v-else-if="works.length === 0" class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
                    <svg class="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-sm text-zinc-500">No works yet</p>
                </div>

                <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div
                        v-for="work in works"
                        :key="work.id"
                        class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden group"
                    >
                        <div class="relative">
                            <img
                                :src="work.url"
                                :alt="work.title"
                                class="w-full aspect-square object-cover"
                            />
                            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div class="flex gap-1">
                                    <button
                                        @click="openEditModal(work)"
                                        class="p-1.5 bg-white rounded text-zinc-700 hover:bg-zinc-100"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        @click="handleDelete(work.id)"
                                        class="p-1.5 bg-white rounded text-red-600 hover:bg-red-50"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="p-2">
                            <p class="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{{ work.title }}</p>
                            <span
                                :class="[
                                    'inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded',
                                    work.status === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    work.status === 'sold' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' :
                                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                ]"
                            >
                                {{ status_labels[work.status] || work.status }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Add Form -->
            <div class="xl:col-span-1">
                <div class="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 sticky top-6">
                    <div class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                        <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Add Work</h2>
                    </div>

                    <div class="p-4 space-y-3">
                        <div class="space-y-1">
                            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Image</label>
                            <input
                                type="file"
                                id="work-file"
                                accept=".jpg,.jpeg,.png"
                                class="block w-full text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 cursor-pointer"
                                @change="handleFileChange"
                            />
                        </div>

                        <div class="space-y-1">
                            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Title</label>
                            <input
                                v-model="form.title"
                                type="text"
                                placeholder="Work title"
                                class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div class="space-y-1">
                                <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Type</label>
                                <select
                                    v-model="form.worktype"
                                    class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                >
                                    <option value="personal">Personal</option>
                                    <option value="client">Client</option>
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Status</label>
                                <select
                                    v-model="form.status"
                                    class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                >
                                    <option value="available">Available</option>
                                    <option value="reserved">Reserved</option>
                                    <option value="sold">Sold</option>
                                    <option value="unavailable">Not for sale</option>
                                </select>
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Description</label>
                            <textarea
                                v-model="form.description"
                                placeholder="Optional description"
                                rows="2"
                                class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                            />
                        </div>

                        <button
                            @click="handleSubmit"
                            :disabled="!form.file || !form.title || is_loading || !auth.is_configured.value"
                            class="w-full px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white dark:text-zinc-900 disabled:text-zinc-400 rounded text-sm font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <svg v-if="is_loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {{ is_loading ? 'Adding...' : 'Add' }}
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

        <!-- Edit Modal -->
        <div
            v-if="edit_modal_open"
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            @click.self="closeEditModal"
        >
            <div class="bg-white dark:bg-zinc-900 rounded-lg w-full max-w-md overflow-hidden">
                <div class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Edit Work</h2>
                    <button @click="closeEditModal" class="text-zinc-400 hover:text-zinc-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div class="p-4 space-y-3">
                    <div v-if="editing_work">
                        <img :src="editing_work.url" :alt="editing_work.title" class="w-full h-32 object-cover rounded mb-3" />
                    </div>

                    <div class="space-y-1">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Title</label>
                        <input
                            v-model="edit_form.title"
                            type="text"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                    </div>

                    <div class="space-y-1">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Status</label>
                        <select
                            v-model="edit_form.status"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        >
                            <option value="available">Available</option>
                            <option value="reserved">Reserved</option>
                            <option value="sold">Sold</option>
                            <option value="unavailable">Not for sale</option>
                        </select>
                    </div>

                    <div class="space-y-1">
                        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Description</label>
                        <textarea
                            v-model="edit_form.description"
                            rows="2"
                            class="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                        />
                    </div>
                </div>

                <div class="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 justify-end">
                    <button
                        @click="closeEditModal"
                        class="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded text-sm transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        @click="handleEditSubmit"
                        :disabled="!edit_form.title || is_editing"
                        class="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-200 text-white dark:text-zinc-900 rounded text-sm font-medium transition-all disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <svg v-if="is_editing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Save
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
