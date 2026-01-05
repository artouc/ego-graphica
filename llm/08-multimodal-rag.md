# マルチモーダルRAG（Claude Vision）

## 概要

Claude 4.5 OpusのVision機能を活用し、画像を理解・検索可能にするマルチモーダルRAG。画像からリッチなテキスト記述を生成し、テキストEmbeddingとして検索可能にする。

```
Image → Claude Vision → Rich Description → Text Embedding → Pinecone
                                                    ↓
Customer Query ────────────────────────────→ Semantic Search
                                                    ↓
                                            Relevant Works
```

---

## アーキテクチャ

```
┌────────────────────────────────────────────────────────────────┐
│                   Multimodal RAG Pipeline                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【インジェスト時】                                              │
│  ┌─────────┐    ┌──────────────────┐    ┌─────────────────┐   │
│  │ 作品画像 │───▶│ Claude Vision    │───▶│ Rich Description │   │
│  │         │    │ 詳細分析          │    │ (JSON構造化)      │   │
│  └─────────┘    └──────────────────┘    └────────┬────────┘   │
│                                                   │             │
│                                                   ▼             │
│                                          ┌───────────────┐     │
│                                          │ Text Embedding │     │
│                                          │ + Pinecone     │     │
│                                          └───────────────┘     │
│                                                                 │
│  【検索時】                                                      │
│  ┌─────────────────┐         ┌──────────────────────────────┐ │
│  │「青い海の絵ある？」│────────▶│ Semantic Search             │ │
│  │                  │         │ → 類似作品を視覚的特徴で検索  │ │
│  └─────────────────┘         └──────────────────────────────┘ │
│                                                                 │
│  【チャット時】                                                  │
│  ┌─────────────────┐         ┌──────────────────────────────┐ │
│  │ 顧客が画像添付   │────────▶│ Claude Vision で分析         │ │
│  │「こんな感じで」  │         │ → 類似作品検索 → 提案        │ │
│  └─────────────────┘         └──────────────────────────────┘ │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 画像分析パイプライン

### 1. Vision分析ユーティリティ

```typescript
// server/utils/vision.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export interface ImageAnalysis {
  // 視覚的特徴
  visual: {
    dominantColors: string[]      // 主要な色 ['深い青', '白', '金']
    colorMood: string             // 色の印象 '落ち着いた', '鮮やか'
    composition: string           // 構図 '中央配置', '三分割'
    style: string                 // スタイル '写実的', '抽象的', 'ミニマル'
    technique: string             // 技法 '油彩風', '水彩風', 'デジタル'
  }

  // コンテンツ
  content: {
    subject: string               // 主題 '海辺の風景'
    elements: string[]            // 要素 ['波', '夕日', '岩']
    mood: string                  // 雰囲気 '静謐', '躍動的'
    narrative: string             // 物語性 'どこか懐かしい夏の記憶を...'
  }

  // メタ情報
  meta: {
    suggestedTags: string[]       // 推奨タグ
    similarStyles: string[]       // 類似スタイル
    targetAudience: string        // ターゲット層
    useCase: string[]             // 用途 ['ポスター', '書籍カバー']
  }

  // 検索用テキスト（全体を統合）
  searchableDescription: string
}

export async function analyzeImage(
  imageUrl: string,
  existingMetadata?: {
    title?: string
    artistStyle?: string
    category?: string
  }
): Promise<ImageAnalysis> {
  const contextHint = existingMetadata
    ? `
参考情報:
- タイトル: ${existingMetadata.title || '不明'}
- アーティストのスタイル: ${existingMetadata.artistStyle || '不明'}
- カテゴリ: ${existingMetadata.category || '不明'}
`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              url: imageUrl
            }
          },
          {
            type: 'text',
            text: `この作品画像を詳細に分析してください。
${contextHint}

以下のJSON形式で出力してください：

{
  "visual": {
    "dominantColors": ["色1", "色2", "色3"],
    "colorMood": "色の全体的な印象",
    "composition": "構図の特徴",
    "style": "アートスタイル",
    "technique": "技法・画材の印象"
  },
  "content": {
    "subject": "主題・モチーフ",
    "elements": ["要素1", "要素2"],
    "mood": "作品の雰囲気",
    "narrative": "この作品が語りかける物語や感情（2-3文）"
  },
  "meta": {
    "suggestedTags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
    "similarStyles": ["類似するアートスタイルや作家"],
    "targetAudience": "この作品が響きそうな層",
    "useCase": ["適した用途1", "適した用途2"]
  },
  "searchableDescription": "この作品を検索で見つけやすくするための自然言語での詳細な説明（100-200字）"
}

JSONのみを出力してください。`
          }
        ]
      }
    ]
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  // JSONパース（コードブロックを除去）
  const jsonStr = content.text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(jsonStr) as ImageAnalysis
}

// Base64画像の分析
export async function analyzeImageBase64(
  base64Data: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  existingMetadata?: {
    title?: string
    artistStyle?: string
    category?: string
  }
): Promise<ImageAnalysis> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          },
          {
            type: 'text',
            text: `この作品画像を詳細に分析してください...` // 同上
          }
        ]
      }
    ]
  })

  // ... パース処理
}
```

### 2. 画像分析の統合（作品アップロード時）

```typescript
// server/api/ingest/work.post.ts の更新版
import { analyzeImage } from '../../utils/vision'
import { embedText, prepareSearchableText } from '../../utils/embedding'
import { upsertVector } from '../../utils/pinecone'

export default defineEventHandler(async (event) => {
  const artistId = await requireAuth(event)
  const formData = await readFormData(event)

  const images = formData.getAll('images') as File[]
  const metadata = JSON.parse(formData.get('metadata') as string)

  // ... 画像アップロード処理（省略）...
  const uploadedImages = await uploadImages(images, artistId)
  const primaryImageUrl = uploadedImages[0].url

  // アーティストのペルソナを取得（スタイル情報）
  const artistDoc = await db.collection('artists').doc(artistId).get()
  const artistStyle = artistDoc.data()?.persona?.motif || ''

  // 🆕 Claude Visionで画像分析
  const imageAnalysis = await analyzeImage(primaryImageUrl, {
    title: metadata.title,
    artistStyle,
    category: metadata.category
  })

  // 検索用テキストを構築（テキスト + 画像分析結果）
  const searchableText = buildMultimodalSearchText({
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    imageAnalysis
  })

  // Firestoreに保存（画像分析結果も含む）
  const workData = {
    // ... 既存フィールド
    imageAnalysis,  // 🆕 分析結果を保存
    searchableText
  }

  await workRef.set(workData)

  // Embedding生成 & Pineconeにインデックス
  const embedding = await embedText(searchableText)

  await upsertVector(artistId, `work_${workRef.id}`, embedding, {
    artistId,
    type: 'work',
    sourceId: workRef.id,
    title: metadata.title,
    category: metadata.category,
    tags: [
      ...(metadata.tags || []),
      ...imageAnalysis.meta.suggestedTags  // 🆕 AIが提案したタグも追加
    ],
    // 🆕 視覚的特徴をメタデータに
    colors: imageAnalysis.visual.dominantColors,
    style: imageAnalysis.visual.style,
    mood: imageAnalysis.content.mood,
    text: searchableText.slice(0, 1000),
    createdAt: new Date().toISOString()
  })

  return {
    success: true,
    workId: workRef.id,
    imageAnalysis  // クライアントに分析結果を返す
  }
})

function buildMultimodalSearchText(params: {
  title: string
  description?: string
  tags?: string[]
  imageAnalysis: ImageAnalysis
}): string {
  const { title, description, tags, imageAnalysis } = params

  const parts = [
    `タイトル: ${title}`,
    description ? `説明: ${description}` : '',
    tags?.length ? `タグ: ${tags.join(', ')}` : '',

    // 画像分析からの情報
    `視覚的特徴: ${imageAnalysis.visual.style}、${imageAnalysis.visual.technique}`,
    `色彩: ${imageAnalysis.visual.dominantColors.join('、')}（${imageAnalysis.visual.colorMood}）`,
    `主題: ${imageAnalysis.content.subject}`,
    `要素: ${imageAnalysis.content.elements.join('、')}`,
    `雰囲気: ${imageAnalysis.content.mood}`,
    `物語性: ${imageAnalysis.content.narrative}`,
    `推奨用途: ${imageAnalysis.meta.useCase.join('、')}`,

    // 検索用の自然言語説明
    imageAnalysis.searchableDescription
  ]

  return parts.filter(Boolean).join('\n')
}
```

---

## 顧客からの画像アップロード対応

### 3. チャットでの画像添付

```typescript
// server/api/chat.post.ts の更新版
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { analyzeImage } from '../utils/vision'
import { searchRelevantContent } from '../utils/rag'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { messages, artistId } = body

  // 最新のユーザーメッセージを取得
  const lastMessage = messages.at(-1)

  // 🆕 画像が含まれているかチェック
  let imageAnalysisContext = ''
  let enhancedQuery = lastMessage?.content || ''

  if (hasImageAttachment(lastMessage)) {
    const imageUrl = extractImageUrl(lastMessage)

    // 顧客が添付した画像を分析
    const analysis = await analyzeImage(imageUrl)

    imageAnalysisContext = `
## 顧客が添付した参考画像の分析

顧客が「こんな感じで」と添付した画像の特徴:
- スタイル: ${analysis.visual.style}
- 色彩: ${analysis.visual.dominantColors.join('、')}
- 雰囲気: ${analysis.content.mood}
- 主題: ${analysis.content.subject}
- 詳細: ${analysis.searchableDescription}

この特徴に近い作品を提案してください。
`

    // 画像の特徴を検索クエリに追加
    enhancedQuery = `${analysis.searchableDescription} ${analysis.content.mood} ${analysis.visual.style}`
  }

  // RAG検索（画像分析結果も含めて）
  const [ragResults, persona] = await Promise.all([
    searchRelevantContent(artistId, enhancedQuery, {
      topK: 5,
      minScore: 0.6
    }),
    getArtistPersona(artistId)
  ])

  const ragContext = buildRAGContext(ragResults)
  const systemPrompt = buildSystemPrompt(persona, ragContext + imageAnalysisContext)

  // Claude 4.5 Opusでストリーミング応答
  const result = streamText({
    model: anthropic('claude-opus-4-5-20250514'),
    system: systemPrompt,
    messages: convertMessagesForClaude(messages),  // 画像を含むメッセージを変換
    tools: chatTools(artistId),
    maxTokens: 4096
  })

  return result.toDataStreamResponse()
})

function hasImageAttachment(message: any): boolean {
  if (!message) return false
  if (Array.isArray(message.content)) {
    return message.content.some((c: any) => c.type === 'image')
  }
  return false
}

function extractImageUrl(message: any): string {
  const imageContent = message.content.find((c: any) => c.type === 'image')
  return imageContent?.source?.url || imageContent?.image_url?.url
}

function convertMessagesForClaude(messages: any[]) {
  return messages.map(msg => {
    if (Array.isArray(msg.content)) {
      return {
        role: msg.role,
        content: msg.content.map((c: any) => {
          if (c.type === 'image') {
            return {
              type: 'image',
              source: {
                type: 'url',
                url: c.source?.url || c.image_url?.url
              }
            }
          }
          return c
        })
      }
    }
    return msg
  })
}
```

### 4. フロントエンド: 画像添付UI

```vue
<!-- components/chat/ChatInput.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const { input, handleSubmit, isLoading } = useChat({
  api: '/api/chat'
})

const attachedImage = ref<{
  file: File
  preview: string
  base64: string
} | null>(null)

const handleImageSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // プレビュー生成
  const preview = URL.createObjectURL(file)

  // Base64変換
  const base64 = await fileToBase64(file)

  attachedImage.value = { file, preview, base64 }
}

const removeImage = () => {
  if (attachedImage.value?.preview) {
    URL.revokeObjectURL(attachedImage.value.preview)
  }
  attachedImage.value = null
}

const handleSubmitWithImage = async (e: Event) => {
  e.preventDefault()

  if (!input.value.trim() && !attachedImage.value) return

  // 画像がある場合はマルチパートで送信
  if (attachedImage.value) {
    const formData = new FormData()
    formData.append('message', input.value)
    formData.append('image', attachedImage.value.file)

    // ... カスタム送信処理
    removeImage()
  } else {
    handleSubmit(e)
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])  // data:image/...;base64, を除去
    }
    reader.readAsDataURL(file)
  })
}
</script>

<template>
  <form @submit="handleSubmitWithImage" class="border-t p-4">
    <!-- 添付画像プレビュー -->
    <div v-if="attachedImage" class="mb-3 relative inline-block">
      <img
        :src="attachedImage.preview"
        class="h-20 w-20 object-cover rounded-lg border"
      />
      <button
        type="button"
        @click="removeImage"
        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
      >
        ×
      </button>
    </div>

    <div class="flex items-center gap-2">
      <!-- 画像添付ボタン -->
      <label class="cursor-pointer p-2 hover:bg-gray-100 rounded">
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleImageSelect"
        />
        <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </label>

      <!-- テキスト入力 -->
      <input
        v-model="input"
        type="text"
        placeholder="メッセージを入力... または画像を添付"
        class="flex-1 p-3 border rounded-lg"
        :disabled="isLoading"
      />

      <!-- 送信ボタン -->
      <button
        type="submit"
        :disabled="isLoading || (!input.trim() && !attachedImage)"
        class="px-4 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        送信
      </button>
    </div>

    <p class="text-xs text-gray-500 mt-2">
      画像を添付して「こんな感じで」と伝えると、類似作品を提案します
    </p>
  </form>
</template>
```

---

## 視覚的類似検索

### 5. 色・スタイルでのフィルタリング

```typescript
// server/utils/visual-search.ts
import { searchSimilar } from './pinecone'
import { embedText } from './embedding'

export interface VisualSearchOptions {
  query?: string
  colors?: string[]           // 色で絞り込み
  style?: string              // スタイルで絞り込み
  mood?: string               // 雰囲気で絞り込み
  topK?: number
}

export async function visualSearch(
  artistId: string,
  options: VisualSearchOptions
) {
  const { query, colors, style, mood, topK = 5 } = options

  // 検索クエリを構築
  const searchParts = [query]

  if (colors?.length) {
    searchParts.push(`色: ${colors.join('、')}`)
  }
  if (style) {
    searchParts.push(`スタイル: ${style}`)
  }
  if (mood) {
    searchParts.push(`雰囲気: ${mood}`)
  }

  const searchQuery = searchParts.filter(Boolean).join(' ')
  const queryEmbedding = await embedText(searchQuery)

  // Pineconeメタデータフィルター
  const filter: Record<string, any> = { type: 'work' }

  if (colors?.length) {
    // 色でフィルタリング（部分一致）
    filter.colors = { $in: colors }
  }
  if (style) {
    filter.style = style
  }

  const results = await searchSimilar(artistId, queryEmbedding, {
    topK,
    filter
  })

  return results
}
```

### 6. 視覚検索ツール

```typescript
// server/utils/tools/visual-search.ts
import { tool } from 'ai'
import { z } from 'zod'
import { visualSearch } from '../visual-search'

export function visualSearchTool(artistId: string) {
  return tool({
    description: `視覚的な特徴で作品を検索します。
色、スタイル、雰囲気などの視覚的要素で絞り込みができます。
「青っぽい作品」「暖かい雰囲気の絵」「ミニマルなデザイン」などの検索に使用します。`,

    parameters: z.object({
      query: z.string().optional().describe('検索キーワード'),

      colors: z.array(z.string()).optional()
        .describe('検索したい色（例: ["青", "白"]）'),

      style: z.enum([
        '写実的', '抽象的', 'ミニマル', 'ポップ',
        '和風', '水彩風', '油彩風', 'デジタル'
      ]).optional().describe('アートスタイル'),

      mood: z.enum([
        '静謐', '躍動的', '幻想的', '懐かしい',
        'クール', '温かい', 'ダーク', 'ポジティブ'
      ]).optional().describe('作品の雰囲気')
    }),

    execute: async ({ query, colors, style, mood }) => {
      const results = await visualSearch(artistId, {
        query,
        colors,
        style,
        mood,
        topK: 6
      })

      return {
        success: true,
        works: results.map(r => ({
          id: r.metadata?.sourceId,
          title: r.metadata?.title,
          colors: r.metadata?.colors,
          style: r.metadata?.style,
          mood: r.metadata?.mood,
          score: r.score
        })),
        displayComponent: 'VisualSearchResults'
      }
    }
  })
}
```

---

## 活用例

### 顧客との会話例

```
👤 顧客: こんにちは、イラストの依頼を考えています

🤖 AI: ケロケロ！お問い合わせありがとうございます。
       どのようなイラストをお探しですか？
       イメージがあれば画像を添付いただくと、
       類似作品をお探しできますよ。

👤 顧客: [画像を添付] こんな感じの雰囲気で、海をテーマにしたものを

🤖 AI: 素敵な参考画像ですね！
       青を基調とした静謐な雰囲気、水彩風のタッチですね。

       [showPortfolio実行: style="水彩風", mood="静謐"]

       こちらの作品たちが近いイメージかと思います。
       特に「波紋の記憶」は海をテーマにしており、
       お客様のイメージに近いのではないでしょうか？

👤 顧客: いいですね！こういう青の色味が好きです

🤖 AI: [visualSearch実行: colors=["深い青", "水色"]]

       青系の作品をもう少しお見せしますね。
       「深海の静寂」「夏の終わり」なども
       同じような色調で制作しています。
```

---

## コスト考慮

| 処理 | API | コスト目安 |
|------|-----|-----------|
| 画像分析（アップロード時） | Claude 4.5 Opus Vision | ~$0.02/画像 |
| 顧客画像分析（チャット時） | Claude 4.5 Opus Vision | ~$0.02/画像 |
| テキストEmbedding | OpenAI text-embedding-3-small | ~$0.00002/1K tokens |

### コスト最適化

```typescript
// 画像分析のキャッシュ（同じ画像の再分析を防ぐ）
import { createHash } from 'crypto'

async function getOrAnalyzeImage(imageUrl: string): Promise<ImageAnalysis> {
  const hash = createHash('md5').update(imageUrl).digest('hex')
  const cacheKey = `image_analysis:${hash}`

  // Firestoreでキャッシュ確認
  const cached = await db.collection('_cache').doc(cacheKey).get()
  if (cached.exists) {
    return cached.data() as ImageAnalysis
  }

  // 新規分析
  const analysis = await analyzeImage(imageUrl)

  // キャッシュ保存（7日間）
  await db.collection('_cache').doc(cacheKey).set({
    ...analysis,
    cachedAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  })

  return analysis
}
```
