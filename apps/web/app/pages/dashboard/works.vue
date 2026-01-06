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
const message = ref("")
const message_type = ref<"success" | "error">("success")

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
    <div class="container mx-auto py-8">
        <div class="space-y-6">
            <div class="flex items-center gap-4">
                <NuxtLink to="/dashboard">
                    <UiButton variant="ghost" size="sm">← 戻る</UiButton>
                </NuxtLink>
                <h1 class="text-3xl font-bold">作品管理</h1>
            </div>

            <!-- 作品一覧 -->
            <UiCard v-if="works.length > 0">
                <UiCardHeader>
                    <UiCardTitle>登録済み作品</UiCardTitle>
                </UiCardHeader>
                <UiCardContent>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div
                            v-for="work in works"
                            :key="work.id"
                            class="border rounded-lg overflow-hidden"
                        >
                            <img
                                :src="work.url"
                                :alt="work.title"
                                class="w-full h-40 object-cover"
                            />
                            <div class="p-3">
                                <h3 class="font-medium truncate">{{ work.title }}</h3>
                                <p class="text-sm text-muted-foreground">{{ work.status }}</p>
                                <UiButton
                                    variant="destructive"
                                    size="sm"
                                    class="mt-2"
                                    @click="handleDelete(work.id)"
                                >
                                    削除
                                </UiButton>
                            </div>
                        </div>
                    </div>
                </UiCardContent>
            </UiCard>

            <!-- 新規登録フォーム -->
            <UiCard>
                <UiCardHeader>
                    <UiCardTitle>新規作品登録</UiCardTitle>
                    <UiCardDescription>
                        作品の情報を入力してください
                    </UiCardDescription>
                </UiCardHeader>
                <UiCardContent>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <UiLabel for="work-file">作品ファイル</UiLabel>
                            <input
                                type="file"
                                id="work-file"
                                accept=".jpg,.jpeg,.png,.wav,.mp4"
                                class="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                @change="handleFileChange"
                            />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="title">タイトル</UiLabel>
                            <UiInput id="title" v-model="form.title" placeholder="作品タイトル" />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="date">作成日</UiLabel>
                            <UiInput id="date" type="date" v-model="form.date" />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="worktype">作品種別</UiLabel>
                            <select
                                id="worktype"
                                v-model="form.worktype"
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="personal">自主制作</option>
                                <option value="client">クライアントワーク</option>
                            </select>
                        </div>

                        <div v-if="form.worktype === 'client'" class="space-y-2">
                            <UiLabel for="client">クライアント名</UiLabel>
                            <UiInput id="client" v-model="form.client" placeholder="クライアント名" />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="status">販売状況</UiLabel>
                            <select
                                id="status"
                                v-model="form.status"
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="available">販売中</option>
                                <option value="reserved">売約済</option>
                                <option value="sold">売却済</option>
                                <option value="unavailable">非売品</option>
                            </select>
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="description">説明</UiLabel>
                            <textarea
                                id="description"
                                v-model="form.description"
                                placeholder="作品の説明"
                                rows="3"
                                class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                        </div>

                        <div class="space-y-2">
                            <UiLabel for="story">制作ストーリー</UiLabel>
                            <textarea
                                id="story"
                                v-model="form.story"
                                placeholder="制作の背景やストーリー"
                                rows="3"
                                class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                        </div>

                        <UiButton
                            @click="handleSubmit"
                            :disabled="!form.file || !form.title || is_loading || !auth.is_configured.value"
                            :loading="is_loading"
                        >
                            登録
                        </UiButton>

                        <UiAlert v-if="message" :variant="message_type === 'error' ? 'destructive' : 'default'">
                            {{ message }}
                        </UiAlert>
                    </div>
                </UiCardContent>
            </UiCard>
        </div>
    </div>
</template>
