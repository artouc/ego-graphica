<script setup lang="ts">
import { ref } from "vue"

definePageMeta({
    layout: "default"
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
        message.value = `作品「${form.value.title}」を登録しました`

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
        message.value = e instanceof Error ? e.message : "作品の登録に失敗しました"
    } finally {
        is_loading.value = false
    }
}

async function handleDelete(id: string) {
    if (!confirm("この作品を削除しますか？")) return

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
        message.value = `作品「${edit_form.value.title}」を更新しました`

        closeEditModal()
        await fetchWorks()
    } catch (e) {
        message_type.value = "error"
        message.value = e instanceof Error ? e.message : "作品の更新に失敗しました"
    } finally {
        is_editing.value = false
    }
}

const status_labels: Record<string, string> = {
    available: "販売中",
    reserved: "売約済",
    sold: "売却済",
    unavailable: "非売品"
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
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AppHeader title="Works" back-to="/dashboard" />

        <main class="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8">
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Works</h1>
                <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    作品ポートフォリオを管理します
                </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- 左カラム: 作品一覧 -->
                <div class="lg:col-span-2 space-y-6">
                    <div v-if="is_fetching" class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                        <div class="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p class="text-sm text-zinc-500">Loading...</p>
                    </div>

                    <div v-else-if="works.length === 0" class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                        <div class="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">No works yet</h3>
                        <p class="text-sm text-zinc-500 dark:text-zinc-400">
                            右のフォームから作品を登録してください
                        </p>
                    </div>

                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            v-for="work in works"
                            :key="work.id"
                            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-md transition-shadow"
                        >
                            <img
                                :src="work.url"
                                :alt="work.title"
                                class="w-full h-48 object-cover"
                            />
                            <div class="p-4">
                                <div class="flex items-start justify-between mb-2">
                                    <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 truncate flex-1">{{ work.title }}</h3>
                                    <span
                                        :class="[
                                            'ml-2 px-2 py-0.5 text-xs rounded-full',
                                            work.status === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            work.status === 'sold' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' :
                                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        ]"
                                    >
                                        {{ status_labels[work.status] || work.status }}
                                    </span>
                                </div>
                                <div class="flex gap-2">
                                    <button
                                        @click="openEditModal(work)"
                                        class="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        @click="handleDelete(work.id)"
                                        class="px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右カラム: 新規登録フォーム -->
                <div class="lg:col-span-1">
                    <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden sticky top-24">
                        <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                                    <svg class="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 class="font-semibold text-zinc-900 dark:text-zinc-100">New Work</h2>
                                    <p class="text-xs text-zinc-500">作品を登録</p>
                                </div>
                            </div>
                        </div>

                        <div class="p-6 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Image</label>
                                <input
                                    type="file"
                                    id="work-file"
                                    accept=".jpg,.jpeg,.png"
                                    class="block w-full text-sm text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-100 file:text-violet-700 dark:file:bg-violet-900/30 dark:file:text-violet-400 hover:file:bg-violet-200 dark:hover:file:bg-violet-900/50 cursor-pointer"
                                    @change="handleFileChange"
                                />
                            </div>

                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title</label>
                                <input
                                    v-model="form.title"
                                    type="text"
                                    placeholder="作品タイトル"
                                    class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>

                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Date</label>
                                <input
                                    v-model="form.date"
                                    type="date"
                                    class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>

                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</label>
                                <select
                                    v-model="form.worktype"
                                    class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                    <option value="personal">自主制作</option>
                                    <option value="client">クライアントワーク</option>
                                </select>
                            </div>

                            <div v-if="form.worktype === 'client'" class="space-y-2">
                                <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Client</label>
                                <input
                                    v-model="form.client"
                                    type="text"
                                    placeholder="クライアント名"
                                    class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>

                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
                                <select
                                    v-model="form.status"
                                    class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                    <option value="available">販売中</option>
                                    <option value="reserved">売約済</option>
                                    <option value="sold">売却済</option>
                                    <option value="unavailable">非売品</option>
                                </select>
                            </div>

                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                                <textarea
                                    v-model="form.description"
                                    placeholder="作品の説明"
                                    rows="2"
                                    class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                />
                            </div>

                            <button
                                @click="handleSubmit"
                                :disabled="!form.file || !form.title || is_loading || !auth.is_configured.value"
                                class="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <svg v-if="is_loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {{ is_loading ? 'Uploading...' : 'Add Work' }}
                            </button>

                            <div
                                v-if="message"
                                :class="[
                                    'p-3 rounded-lg text-sm',
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
        </main>

        <!-- 編集モーダル -->
        <div
            v-if="edit_modal_open"
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            @click.self="closeEditModal"
        >
            <div class="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit Work</h2>
                    <button @click="closeEditModal" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div class="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <div v-if="editing_work">
                        <img
                            :src="editing_work.url"
                            :alt="editing_work.title"
                            class="w-full h-40 object-cover rounded-lg mb-4"
                        />
                    </div>

                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title</label>
                        <input
                            v-model="edit_form.title"
                            type="text"
                            class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>

                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
                        <select
                            v-model="edit_form.status"
                            class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            <option value="available">販売中</option>
                            <option value="reserved">売約済</option>
                            <option value="sold">売却済</option>
                            <option value="unavailable">非売品</option>
                        </select>
                    </div>

                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                        <textarea
                            v-model="edit_form.description"
                            rows="3"
                            class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                        />
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 justify-end">
                    <button
                        @click="closeEditModal"
                        class="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        @click="handleEditSubmit"
                        :disabled="!edit_form.title || is_editing"
                        class="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <svg v-if="is_editing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Save
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
