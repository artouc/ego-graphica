# RAG (Retrieval Augmented Generation) 実装

## 概要

RAGを使用して、アーティストの作品・記事・ポッドキャストから関連情報を検索し、回答の文脈として提供する。

```
User Query → Embedding → Pinecone Search → Context Injection → Claude Response
```

---

## Embedding パイプライン

### 1. Embeddingユーティリティ

```typescript
// server/utils/embedding.ts
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536
  })

  return response.data[0].embedding
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    dimensions: 1536
  })

  return response.data.map(d => d.embedding)
}

// 検索用テキストの前処理
export function prepareSearchableText(params: {
  title: string
  description?: string
  tags?: string[]
  content?: string
}): string {
  const parts = [
    params.title,
    params.description,
    params.tags?.join(' '),
    params.content
  ].filter(Boolean)

  // 最大8000文字に制限（Embeddingモデルの制限）
  return parts.join('\n\n').slice(0, 8000)
}
```

### 2. Pineconeクライアント

```typescript
// server/utils/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone'

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
})

const index = pinecone.index(process.env.PINECONE_INDEX!)

export interface VectorMetadata {
  artistId: string
  type: 'work' | 'article' | 'podcast'
  sourceId: string
  title: string
  category?: string
  tags: string[]
  text: string
  createdAt: string
}

// ベクトル追加
export async function upsertVector(
  artistId: string,
  id: string,
  embedding: number[],
  metadata: VectorMetadata
) {
  await index.namespace(artistId).upsert([
    {
      id,
      values: embedding,
      metadata
    }
  ])
}

// ベクトル削除
export async function deleteVector(artistId: string, id: string) {
  await index.namespace(artistId).deleteOne(id)
}

// 類似検索
export async function searchSimilar(
  artistId: string,
  queryEmbedding: number[],
  options: {
    topK?: number
    filter?: Record<string, unknown>
  } = {}
) {
  const { topK = 5, filter } = options

  const results = await index.namespace(artistId).query({
    vector: queryEmbedding,
    topK,
    filter,
    includeMetadata: true
  })

  return results.matches || []
}

export { index as pineconeIndex }
```

---

## 検索実装

### 3. RAG検索サービス

```typescript
// server/utils/rag.ts
import { embedText } from './embedding'
import { searchSimilar, type VectorMetadata } from './pinecone'
import { getFirestore } from 'firebase-admin/firestore'

export interface RAGResult {
  type: 'work' | 'article' | 'podcast'
  sourceId: string
  title: string
  score: number
  snippet: string
  metadata: VectorMetadata
  // 追加情報（Firestoreから取得）
  fullData?: Record<string, unknown>
}

export async function searchRelevantContent(
  artistId: string,
  query: string,
  options: {
    topK?: number
    types?: ('work' | 'article' | 'podcast')[]
    minScore?: number
    includeFullData?: boolean
  } = {}
): Promise<RAGResult[]> {
  const {
    topK = 5,
    types,
    minScore = 0.7,
    includeFullData = false
  } = options

  // 1. クエリをEmbedding化
  const queryEmbedding = await embedText(query)

  // 2. フィルター構築
  const filter = types
    ? { type: { $in: types } }
    : undefined

  // 3. Pinecone検索
  const matches = await searchSimilar(artistId, queryEmbedding, {
    topK,
    filter
  })

  // 4. スコアフィルタリング & 結果整形
  const results: RAGResult[] = matches
    .filter(match => (match.score || 0) >= minScore)
    .map(match => {
      const metadata = match.metadata as VectorMetadata
      return {
        type: metadata.type,
        sourceId: metadata.sourceId,
        title: metadata.title,
        score: match.score || 0,
        snippet: metadata.text.slice(0, 300) + '...',
        metadata
      }
    })

  // 5. オプション：Firestoreから詳細データ取得
  if (includeFullData && results.length > 0) {
    const db = getFirestore()

    await Promise.all(
      results.map(async (result) => {
        const collectionName = `${result.type}s` // works, articles, podcasts
        const doc = await db.collection(collectionName).doc(result.sourceId).get()
        if (doc.exists) {
          result.fullData = doc.data()
        }
      })
    )
  }

  return results
}

// チャット用コンテキスト生成
export function buildRAGContext(results: RAGResult[]): string {
  if (results.length === 0) {
    return ''
  }

  const sections = results.map((result, i) => {
    const typeLabel = {
      work: '作品',
      article: '記事',
      podcast: 'ポッドキャスト'
    }[result.type]

    return `### ${typeLabel} ${i + 1}: ${result.title}
${result.snippet}
関連度スコア: ${(result.score * 100).toFixed(1)}%`
  })

  return `## 参照可能なアーティストのコンテンツ

以下は、顧客の質問に関連するアーティストのコンテンツです。
これらの情報を参考に、アーティストの視点で回答してください。

${sections.join('\n\n')}`
}
```

---

## チャットAPIでの統合

### 4. メインチャットエンドポイント

```typescript
// server/api/chat.post.ts
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { searchRelevantContent, buildRAGContext } from '../utils/rag'
import { getArtistPersona, buildSystemPrompt } from '../utils/persona'
import { chatTools } from '../utils/tools'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { messages, artistId } = body

  // 最新のユーザーメッセージを取得
  const lastUserMessage = messages
    .filter((m: { role: string }) => m.role === 'user')
    .at(-1)?.content || ''

  // 並列実行: RAG検索 & ペルソナ取得
  const [ragResults, persona] = await Promise.all([
    searchRelevantContent(artistId, lastUserMessage, {
      topK: 5,
      minScore: 0.65
    }),
    getArtistPersona(artistId)
  ])

  // コンテキスト構築
  const ragContext = buildRAGContext(ragResults)

  // システムプロンプト構築（ペルソナ + RAGコンテキスト）
  const systemPrompt = buildSystemPrompt(persona, ragContext)

  // Claude 4.5 Opus でストリーミング応答
  const result = streamText({
    model: anthropic('claude-opus-4-5-20250514'),
    system: systemPrompt,
    messages,
    tools: chatTools(artistId),
    maxTokens: 4096,
    temperature: 0.7
  })

  return result.toDataStreamResponse()
})
```

---

## 検索の最適化

### ハイブリッド検索（将来拡張）

```typescript
// server/utils/hybrid-search.ts

// キーワード検索 + ベクトル検索の組み合わせ
export async function hybridSearch(
  artistId: string,
  query: string
): Promise<RAGResult[]> {
  // 1. ベクトル検索（意味的類似性）
  const semanticResults = await searchRelevantContent(artistId, query, {
    topK: 10,
    minScore: 0.6
  })

  // 2. キーワード検索（Firestore全文検索 or Algolia）
  const keywordResults = await keywordSearch(artistId, query)

  // 3. スコア統合 (RRF: Reciprocal Rank Fusion)
  const combined = reciprocalRankFusion([
    semanticResults,
    keywordResults
  ])

  return combined.slice(0, 5)
}

function reciprocalRankFusion(
  resultSets: RAGResult[][],
  k: number = 60
): RAGResult[] {
  const scores = new Map<string, number>()
  const items = new Map<string, RAGResult>()

  resultSets.forEach(results => {
    results.forEach((result, rank) => {
      const id = `${result.type}_${result.sourceId}`
      const currentScore = scores.get(id) || 0
      scores.set(id, currentScore + 1 / (k + rank + 1))
      items.set(id, result)
    })
  })

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => items.get(id)!)
}
```

### クエリ拡張

```typescript
// server/utils/query-expansion.ts
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// LLMでクエリを拡張して検索精度向上
export async function expandQuery(originalQuery: string): Promise<string[]> {
  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'), // 軽量モデルで高速化
    prompt: `以下のユーザー質問から、関連する検索キーワードを3つ生成してください。
JSON配列形式で出力してください。

質問: ${originalQuery}

出力例: ["キーワード1", "キーワード2", "キーワード3"]`,
    maxTokens: 100
  })

  try {
    return JSON.parse(text)
  } catch {
    return [originalQuery]
  }
}
```

---

## インデックス更新フロー

```
作品追加/更新
     │
     ▼
Firestore Trigger (Cloud Functions)
     │
     ▼
prepareSearchableText()
     │
     ▼
embedText()
     │
     ▼
upsertVector() → Pinecone
```

```typescript
// Firebase Cloud Function例
// functions/src/index.ts

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { embedText, prepareSearchableText, upsertVector, deleteVector } from './utils'

export const onWorkWritten = onDocumentWritten(
  'works/{workId}',
  async (event) => {
    const workId = event.params.workId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    // 削除された場合
    if (!after) {
      await deleteVector(before.artistId, `work_${workId}`)
      return
    }

    // 追加/更新された場合
    const searchableText = prepareSearchableText({
      title: after.title,
      description: after.description,
      tags: after.tags
    })

    const embedding = await embedText(searchableText)

    await upsertVector(after.artistId, `work_${workId}`, embedding, {
      artistId: after.artistId,
      type: 'work',
      sourceId: workId,
      title: after.title,
      category: after.category,
      tags: after.tags || [],
      text: searchableText.slice(0, 1000),
      createdAt: after.createdAt.toDate().toISOString()
    })
  }
)
```
