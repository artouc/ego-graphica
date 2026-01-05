# データ取り込みパイプライン

## 概要

アーティストのコンテンツ（作品、記事、ポッドキャスト）をシステムに取り込み、Embedding化してRAG検索可能にするパイプライン。

```
Upload → Validation → Storage → Transcription (if audio) → Embedding → Indexing
```

---

## パイプライン構成

```
┌────────────────────────────────────────────────────────────────┐
│                      Data Ingestion Pipeline                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌─────────┐ │
│   │ Upload  │───▶│ Validate │───▶│  Process  │───▶│  Index  │ │
│   │   API   │    │  & Store │    │ (Embed/   │    │Pinecone │ │
│   └─────────┘    └──────────┘    │ Transcribe)    └─────────┘ │
│        │              │          └───────────┘         │       │
│        ▼              ▼                │               ▼       │
│   ┌─────────┐    ┌──────────┐         │         ┌─────────┐   │
│   │Firebase │    │Firestore │◀────────┘         │ Search  │   │
│   │Storage  │    │ Metadata │                   │  Ready  │   │
│   └─────────┘    └──────────┘                   └─────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 作品取り込み

### 1. 作品アップロードAPI

```typescript
// server/api/ingest/work.post.ts
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { embedText, prepareSearchableText } from '../../utils/embedding'
import { upsertVector } from '../../utils/pinecone'

export default defineEventHandler(async (event) => {
  // 認証チェック
  const artistId = await requireAuth(event)

  const formData = await readFormData(event)

  // 画像ファイル取得
  const images = formData.getAll('images') as File[]
  const metadata = JSON.parse(formData.get('metadata') as string)

  // バリデーション
  if (!metadata.title || images.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Title and at least one image are required'
    })
  }

  const db = getFirestore()
  const storage = getStorage()
  const bucket = storage.bucket()

  // 1. 画像をFirebase Storageにアップロード
  const uploadedImages = await Promise.all(
    images.map(async (image, index) => {
      const filename = `artists/${artistId}/works/${Date.now()}_${index}_${image.name}`
      const file = bucket.file(filename)

      const buffer = Buffer.from(await image.arrayBuffer())
      await file.save(buffer, {
        metadata: {
          contentType: image.type
        }
      })

      await file.makePublic()
      const url = `https://storage.googleapis.com/${bucket.name}/${filename}`

      // サムネイル生成（Cloud Functions経由 or 別途処理）
      const thumbnailUrl = url // TODO: 実際はリサイズ処理

      return {
        url,
        thumbnailUrl,
        alt: metadata.title,
        isPrimary: index === 0,
        order: index
      }
    })
  )

  // 2. 検索用テキスト準備
  const searchableText = prepareSearchableText({
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags
  })

  // 3. Firestoreにメタデータ保存
  const workRef = db.collection('works').doc()
  const workData = {
    id: workRef.id,
    artistId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    title: metadata.title,
    titleEn: metadata.titleEn || null,
    description: metadata.description || '',
    descriptionEn: metadata.descriptionEn || null,
    category: metadata.category || 'illustration',
    tags: metadata.tags || [],
    styles: metadata.styles || [],
    images: uploadedImages,
    year: metadata.year || new Date().getFullYear(),
    medium: metadata.medium || '',
    dimensions: metadata.dimensions || null,
    isForSale: metadata.isForSale || false,
    price: metadata.price || null,
    isCommissionable: metadata.isCommissionable ?? true,
    isPublic: metadata.isPublic ?? true,
    isFeatured: metadata.isFeatured || false,
    searchableText
  }

  await workRef.set(workData)

  // 4. Embedding生成 & Pineconeにインデックス
  const embedding = await embedText(searchableText)

  await upsertVector(artistId, `work_${workRef.id}`, embedding, {
    artistId,
    type: 'work',
    sourceId: workRef.id,
    title: metadata.title,
    category: metadata.category,
    tags: metadata.tags || [],
    text: searchableText.slice(0, 1000),
    createdAt: new Date().toISOString()
  })

  return {
    success: true,
    workId: workRef.id,
    message: 'Work uploaded and indexed successfully'
  }
})
```

### 2. 作品アップロードフォーム

```vue
<!-- components/dashboard/WorkUploadForm.vue -->
<script setup lang="ts">
import type { WorkCategory } from '~/types/work'

const isUploading = ref(false)
const uploadProgress = ref(0)

const form = ref({
  title: '',
  titleEn: '',
  description: '',
  category: 'illustration' as WorkCategory,
  tags: [] as string[],
  styles: [] as string[],
  year: new Date().getFullYear(),
  medium: '',
  isPublic: true,
  isFeatured: false
})

const images = ref<File[]>([])
const imagePreviews = ref<string[]>([])

const categoryOptions = [
  { value: 'illustration', label: 'イラスト' },
  { value: 'painting', label: '絵画' },
  { value: 'mural', label: '壁画' },
  { value: 'graphic_design', label: 'グラフィックデザイン' },
  { value: 'character_design', label: 'キャラクターデザイン' },
  { value: 'concept_art', label: 'コンセプトアート' }
]

const handleImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  const newFiles = Array.from(input.files)
  images.value = [...images.value, ...newFiles]

  // プレビュー生成
  newFiles.forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreviews.value.push(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  })
}

const removeImage = (index: number) => {
  images.value.splice(index, 1)
  imagePreviews.value.splice(index, 1)
}

const handleSubmit = async () => {
  if (images.value.length === 0) {
    alert('画像を1枚以上選択してください')
    return
  }

  isUploading.value = true

  const formData = new FormData()
  images.value.forEach(img => formData.append('images', img))
  formData.append('metadata', JSON.stringify(form.value))

  try {
    const result = await $fetch('/api/ingest/work', {
      method: 'POST',
      body: formData,
      onUploadProgress: (progress) => {
        uploadProgress.value = Math.round((progress.loaded / progress.total!) * 100)
      }
    })

    alert('作品をアップロードしました')
    // フォームリセット
    form.value = { ...form.value, title: '', description: '' }
    images.value = []
    imagePreviews.value = []
  } catch (error) {
    console.error('Upload failed:', error)
    alert('アップロードに失敗しました')
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <!-- 画像アップロード -->
    <div>
      <label class="block text-sm font-medium mb-2">画像</label>
      <div class="grid grid-cols-4 gap-3 mb-3">
        <div
          v-for="(preview, index) in imagePreviews"
          :key="index"
          class="relative aspect-square"
        >
          <img :src="preview" class="w-full h-full object-cover rounded" />
          <button
            type="button"
            @click="removeImage(index)"
            class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6"
          >
            ×
          </button>
        </div>
        <label class="aspect-square border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-gray-50">
          <input
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="handleImageSelect"
          />
          <span class="text-gray-400 text-3xl">+</span>
        </label>
      </div>
    </div>

    <!-- 基本情報 -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">タイトル *</label>
        <input v-model="form.title" required class="w-full p-2 border rounded" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Title (EN)</label>
        <input v-model="form.titleEn" class="w-full p-2 border rounded" />
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">説明</label>
      <textarea v-model="form.description" rows="4" class="w-full p-2 border rounded" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">カテゴリ</label>
        <select v-model="form.category" class="w-full p-2 border rounded">
          <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">制作年</label>
        <input v-model.number="form.year" type="number" class="w-full p-2 border rounded" />
      </div>
    </div>

    <!-- 送信 -->
    <button
      type="submit"
      :disabled="isUploading"
      class="w-full py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      <span v-if="isUploading">アップロード中... {{ uploadProgress }}%</span>
      <span v-else>作品を登録</span>
    </button>
  </form>
</template>
```

---

## 音声取り込み（ポッドキャスト）

### 3. 音声アップロード & 文字起こしAPI

```typescript
// server/api/ingest/audio.post.ts
import OpenAI from 'openai'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { embedText, prepareSearchableText } from '../../utils/embedding'
import { upsertVector } from '../../utils/pinecone'

const openai = new OpenAI()

export default defineEventHandler(async (event) => {
  const artistId = await requireAuth(event)

  const formData = await readFormData(event)
  const audioFile = formData.get('audio') as File
  const metadata = JSON.parse(formData.get('metadata') as string)

  if (!audioFile) {
    throw createError({
      statusCode: 400,
      message: 'Audio file is required'
    })
  }

  const db = getFirestore()
  const storage = getStorage()
  const bucket = storage.bucket()

  // 1. 音声ファイルをStorageにアップロード
  const filename = `artists/${artistId}/podcasts/${Date.now()}_${audioFile.name}`
  const file = bucket.file(filename)

  const buffer = Buffer.from(await audioFile.arrayBuffer())
  await file.save(buffer, {
    metadata: { contentType: audioFile.type }
  })

  await file.makePublic()
  const audioUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`

  // 2. Firestoreにメタデータ保存（文字起こし前）
  const podcastRef = db.collection('podcasts').doc()
  const podcastData = {
    id: podcastRef.id,
    artistId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    title: metadata.title,
    description: metadata.description || '',
    audioUrl,
    duration: metadata.duration || 0,
    coverImageUrl: metadata.coverImageUrl || null,
    transcript: null,
    transcriptStatus: 'processing' as const,
    isPublic: metadata.isPublic ?? true,
    publishedAt: metadata.publishedAt ? Timestamp.fromDate(new Date(metadata.publishedAt)) : null,
    searchableText: ''
  }

  await podcastRef.set(podcastData)

  // 3. 文字起こし実行（非同期で処理）
  // Note: 長時間音声の場合はCloud Functionsにオフロードすることを推奨
  transcribeAudio(artistId, podcastRef.id, audioFile)
    .catch(err => console.error('Transcription failed:', err))

  return {
    success: true,
    podcastId: podcastRef.id,
    message: 'Audio uploaded. Transcription in progress.',
    status: 'processing'
  }
})

async function transcribeAudio(artistId: string, podcastId: string, audioFile: File) {
  const db = getFirestore()
  const podcastRef = db.collection('podcasts').doc(podcastId)

  try {
    // OpenAI Whisper APIで文字起こし
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ja',
      response_format: 'text'
    })

    const transcript = transcription

    // 検索用テキスト
    const podcastDoc = await podcastRef.get()
    const title = podcastDoc.data()?.title || ''

    const searchableText = prepareSearchableText({
      title,
      content: transcript
    })

    // Firestore更新
    await podcastRef.update({
      transcript,
      transcriptStatus: 'completed',
      searchableText,
      updatedAt: Timestamp.now()
    })

    // Embedding生成 & Pineconeにインデックス
    const embedding = await embedText(searchableText)

    await upsertVector(artistId, `podcast_${podcastId}`, embedding, {
      artistId,
      type: 'podcast',
      sourceId: podcastId,
      title,
      tags: [],
      text: searchableText.slice(0, 1000),
      createdAt: new Date().toISOString()
    })

    console.log(`Transcription completed for podcast: ${podcastId}`)
  } catch (error) {
    console.error('Transcription error:', error)

    await podcastRef.update({
      transcriptStatus: 'failed',
      updatedAt: Timestamp.now()
    })
  }
}
```

---

## 記事取り込み

### 4. 記事保存API

```typescript
// server/api/ingest/article.post.ts
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { embedText, prepareSearchableText } from '../../utils/embedding'
import { upsertVector } from '../../utils/pinecone'

export default defineEventHandler(async (event) => {
  const artistId = await requireAuth(event)
  const body = await readBody(event)

  const { title, content, category, tags, coverImageUrl, isPublic } = body

  if (!title || !content) {
    throw createError({
      statusCode: 400,
      message: 'Title and content are required'
    })
  }

  const db = getFirestore()

  // 検索用テキスト
  const searchableText = prepareSearchableText({
    title,
    content,
    tags
  })

  // Firestoreに保存
  const articleRef = db.collection('articles').doc()
  const articleData = {
    id: articleRef.id,
    artistId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    title,
    content,
    excerpt: content.slice(0, 200),
    category: category || 'diary',
    tags: tags || [],
    coverImageUrl: coverImageUrl || null,
    isPublic: isPublic ?? true,
    publishedAt: isPublic ? Timestamp.now() : null,
    searchableText
  }

  await articleRef.set(articleData)

  // Embedding生成 & Pineconeにインデックス
  const embedding = await embedText(searchableText)

  await upsertVector(artistId, `article_${articleRef.id}`, embedding, {
    artistId,
    type: 'article',
    sourceId: articleRef.id,
    title,
    category: category || 'diary',
    tags: tags || [],
    text: searchableText.slice(0, 1000),
    createdAt: new Date().toISOString()
  })

  return {
    success: true,
    articleId: articleRef.id,
    message: 'Article saved and indexed successfully'
  }
})
```

---

## バッチ処理（既存データの再インデックス）

### 5. 再インデックスバッチ

```typescript
// server/api/admin/reindex.post.ts
import { getFirestore } from 'firebase-admin/firestore'
import { embedText, prepareSearchableText } from '../../utils/embedding'
import { upsertVector, pineconeIndex } from '../../utils/pinecone'

export default defineEventHandler(async (event) => {
  // 管理者権限チェック
  await requireAdmin(event)

  const body = await readBody(event)
  const { artistId, types } = body

  const db = getFirestore()
  const results = { works: 0, articles: 0, podcasts: 0 }

  // 作品の再インデックス
  if (!types || types.includes('work')) {
    const worksSnapshot = await db.collection('works')
      .where('artistId', '==', artistId)
      .get()

    for (const doc of worksSnapshot.docs) {
      const work = doc.data()
      const searchableText = prepareSearchableText({
        title: work.title,
        description: work.description,
        tags: work.tags
      })

      const embedding = await embedText(searchableText)

      await upsertVector(artistId, `work_${doc.id}`, embedding, {
        artistId,
        type: 'work',
        sourceId: doc.id,
        title: work.title,
        category: work.category,
        tags: work.tags || [],
        text: searchableText.slice(0, 1000),
        createdAt: work.createdAt?.toDate().toISOString() || new Date().toISOString()
      })

      results.works++
    }
  }

  // 記事の再インデックス
  if (!types || types.includes('article')) {
    const articlesSnapshot = await db.collection('articles')
      .where('artistId', '==', artistId)
      .get()

    for (const doc of articlesSnapshot.docs) {
      const article = doc.data()
      const searchableText = prepareSearchableText({
        title: article.title,
        content: article.content,
        tags: article.tags
      })

      const embedding = await embedText(searchableText)

      await upsertVector(artistId, `article_${doc.id}`, embedding, {
        artistId,
        type: 'article',
        sourceId: doc.id,
        title: article.title,
        category: article.category,
        tags: article.tags || [],
        text: searchableText.slice(0, 1000),
        createdAt: article.createdAt?.toDate().toISOString() || new Date().toISOString()
      })

      results.articles++
    }
  }

  // ポッドキャストの再インデックス
  if (!types || types.includes('podcast')) {
    const podcastsSnapshot = await db.collection('podcasts')
      .where('artistId', '==', artistId)
      .where('transcriptStatus', '==', 'completed')
      .get()

    for (const doc of podcastsSnapshot.docs) {
      const podcast = doc.data()
      const searchableText = prepareSearchableText({
        title: podcast.title,
        content: podcast.transcript
      })

      const embedding = await embedText(searchableText)

      await upsertVector(artistId, `podcast_${doc.id}`, embedding, {
        artistId,
        type: 'podcast',
        sourceId: doc.id,
        title: podcast.title,
        tags: [],
        text: searchableText.slice(0, 1000),
        createdAt: podcast.createdAt?.toDate().toISOString() || new Date().toISOString()
      })

      results.podcasts++
    }
  }

  return {
    success: true,
    indexed: results
  }
})
```

---

## データ削除フロー

```typescript
// server/api/works/[id].delete.ts
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { deleteVector } from '../../utils/pinecone'

export default defineEventHandler(async (event) => {
  const artistId = await requireAuth(event)
  const workId = getRouterParam(event, 'id')

  const db = getFirestore()
  const storage = getStorage()

  // 作品データ取得
  const workRef = db.collection('works').doc(workId!)
  const workDoc = await workRef.get()

  if (!workDoc.exists || workDoc.data()?.artistId !== artistId) {
    throw createError({
      statusCode: 404,
      message: 'Work not found'
    })
  }

  const workData = workDoc.data()!

  // 1. Storageから画像削除
  const bucket = storage.bucket()
  for (const image of workData.images || []) {
    const filename = image.url.split(`${bucket.name}/`)[1]
    if (filename) {
      await bucket.file(filename).delete().catch(() => {})
    }
  }

  // 2. Pineconeからベクトル削除
  await deleteVector(artistId, `work_${workId}`)

  // 3. Firestoreから削除
  await workRef.delete()

  return {
    success: true,
    message: 'Work deleted successfully'
  }
})
```
