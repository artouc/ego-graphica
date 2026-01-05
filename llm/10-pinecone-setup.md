# Pinecone セットアップガイド

## 概要

Pineconeはベクトルデータベースサービス。アーティストの作品・記事・ポッドキャストをEmbedding化して保存し、セマンティック検索（RAG）を実現する。

```
作品データ → OpenAI Embedding (text-embedding-3-large) → Pinecone (GCP) → 類似検索
```

---

## 1. アカウント作成

### 1.1 サインアップ

1. https://www.pinecone.io/ にアクセス
2. 「Start Free」をクリック
3. Google/GitHub/メールでアカウント作成

### 1.2 無料枠

| 項目 | 制限 |
|------|------|
| Indexes | 5個まで |
| Vectors | 100K/月 |
| Namespaces | 無制限 |
| Storage | 2GB |

---

## 2. Index 作成

### 2.1 Pinecone Console で作成

1. https://app.pinecone.io/ にログイン
2. 「Create Index」をクリック
3. 以下の設定を入力:

| 設定項目 | 値 | 説明 |
|---------|-----|------|
| Index Name | `egographica` | プロジェクト名 |
| Dimensions | `3072` | text-embedding-3-large の次元数 |
| Metric | `cosine` | コサイン類似度（テキスト検索に最適） |
| Cloud | `GCP` | Firebase と同じプロバイダー |
| Region | `us-central1` | 汎用的なリージョン |
| Type | `Serverless` | コールドスタートなし |

4. 「Create Index」をクリック

### 2.2 CLI で作成（オプション）

```bash
# Pinecone CLI インストール
npm install -g pinecone-cli

# ログイン
pinecone login

# Index作成
pinecone create-index egographica \
  --dimension 3072 \
  --metric cosine \
  --cloud gcp \
  --region us-central1
```

---

## 3. API Key 取得

### 3.1 Console から取得

1. Pinecone Console の左サイドバー → 「API Keys」
2. 「Create API Key」をクリック
3. 名前を入力（例: `egographica-production`）
4. 生成されたキーをコピー

### 3.2 環境変数に設定

```bash
# .env
PINECONE_API_KEY=pcsk_xxxxxx...
PINECONE_INDEX=egographica
```

---

## 4. 実装

### 4.1 Pinecone クライアント初期化

```typescript
// apps/api/utils/db/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone'

let pineconeClient: Pinecone | null = null

export function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const config = useRuntimeConfig()

    if (!config.pineconeApiKey) {
      throw new Error('PINECONE_API_KEY is not configured')
    }

    pineconeClient = new Pinecone({
      apiKey: config.pineconeApiKey
    })
  }

  return pineconeClient
}

export function getIndex() {
  const config = useRuntimeConfig()
  return getPinecone().index(config.pineconeIndex || 'egographica')
}
```

### 4.2 ベクトル操作ユーティリティ

```typescript
// apps/api/utils/db/pinecone.ts (続き)

export interface VectorMetadata {
  artistId: string
  type: 'work' | 'article' | 'podcast'
  sourceId: string
  title: string
  category?: string
  tags: string[]
  colors?: string[]      // 画像分析結果
  style?: string         // アートスタイル
  mood?: string          // 雰囲気
  text: string           // 検索用テキスト（1000文字以内）
  createdAt: string      // ISO 8601
}

// ベクトル追加・更新
export async function upsertVector(
  artistId: string,
  id: string,
  embedding: number[],
  metadata: VectorMetadata
): Promise<void> {
  const index = getIndex()

  await index.namespace(artistId).upsert([
    {
      id,
      values: embedding,
      metadata
    }
  ])
}

// ベクトル削除
export async function deleteVector(
  artistId: string,
  id: string
): Promise<void> {
  const index = getIndex()
  await index.namespace(artistId).deleteOne(id)
}

// 複数ベクトル削除
export async function deleteVectors(
  artistId: string,
  ids: string[]
): Promise<void> {
  const index = getIndex()
  await index.namespace(artistId).deleteMany(ids)
}

// Namespace削除（アーティスト全データ削除）
export async function deleteNamespace(artistId: string): Promise<void> {
  const index = getIndex()
  await index.namespace(artistId).deleteAll()
}
```

### 4.3 類似検索

```typescript
// apps/api/utils/db/pinecone.ts (続き)

export interface SearchOptions {
  topK?: number
  filter?: Record<string, unknown>
  includeMetadata?: boolean
}

export interface SearchResult {
  id: string
  score: number
  metadata?: VectorMetadata
}

// 類似ベクトル検索
export async function searchSimilar(
  artistId: string,
  queryEmbedding: number[],
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = 5,
    filter,
    includeMetadata = true
  } = options

  const index = getIndex()

  const results = await index.namespace(artistId).query({
    vector: queryEmbedding,
    topK,
    filter,
    includeMetadata
  })

  return (results.matches || []).map(match => ({
    id: match.id,
    score: match.score || 0,
    metadata: match.metadata as VectorMetadata | undefined
  }))
}

// タイプ別検索
export async function searchByType(
  artistId: string,
  queryEmbedding: number[],
  type: 'work' | 'article' | 'podcast',
  topK: number = 5
): Promise<SearchResult[]> {
  return searchSimilar(artistId, queryEmbedding, {
    topK,
    filter: { type: { $eq: type } }
  })
}

// 色・スタイルで絞り込み検索
export async function searchByVisual(
  artistId: string,
  queryEmbedding: number[],
  options: {
    colors?: string[]
    style?: string
    mood?: string
    topK?: number
  }
): Promise<SearchResult[]> {
  const filter: Record<string, unknown> = { type: { $eq: 'work' } }

  if (options.colors?.length) {
    filter.colors = { $in: options.colors }
  }
  if (options.style) {
    filter.style = { $eq: options.style }
  }
  if (options.mood) {
    filter.mood = { $eq: options.mood }
  }

  return searchSimilar(artistId, queryEmbedding, {
    topK: options.topK || 5,
    filter
  })
}
```

### 4.4 Index統計情報

```typescript
// apps/api/utils/db/pinecone.ts (続き)

export interface IndexStats {
  totalVectorCount: number
  namespaces: Record<string, { vectorCount: number }>
}

export async function getIndexStats(): Promise<IndexStats> {
  const index = getIndex()
  const stats = await index.describeIndexStats()

  return {
    totalVectorCount: stats.totalRecordCount || 0,
    namespaces: stats.namespaces || {}
  }
}

// アーティストのベクトル数を取得
export async function getArtistVectorCount(artistId: string): Promise<number> {
  const stats = await getIndexStats()
  return stats.namespaces[artistId]?.vectorCount || 0
}
```

---

## 5. Namespace 設計

### アーティストごとにNamespaceを分離

```
Index: egographica
├── Namespace: artist_001
│   ├── work_xxxxx (作品)
│   ├── work_yyyyy
│   ├── article_aaaaa (記事)
│   └── podcast_bbbbb (ポッドキャスト)
│
├── Namespace: artist_002
│   ├── work_zzzzz
│   └── ...
│
└── Namespace: artist_003
    └── ...
```

### メリット

1. **データ分離**: アーティストごとに完全分離
2. **検索効率**: Namespaceスコープで高速検索
3. **削除容易**: アーティスト退会時に一括削除可能
4. **スケーラブル**: アーティスト数に制限なし

---

## 6. Embedding生成

### OpenAI text-embedding-3-large

高精度な3072次元のEmbeddingモデルを使用。日本語対応も優秀。

```typescript
// apps/api/utils/ai/embedding.ts
import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const config = useRuntimeConfig()
    openaiClient = new OpenAI({
      apiKey: config.openaiApiKey
    })
  }
  return openaiClient
}

// 単一テキストをEmbedding化
export async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAI()

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 3072
  })

  return response.data[0].embedding
}

// 複数テキストをバッチEmbedding化
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI()

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: texts,
    dimensions: 3072
  })

  return response.data.map(d => d.embedding)
}

// 検索用テキストの前処理
export function prepareSearchableText(params: {
  title: string
  description?: string
  tags?: string[]
  content?: string
  imageDescription?: string
}): string {
  const parts = [
    params.title,
    params.description,
    params.tags?.join(' '),
    params.content,
    params.imageDescription
  ].filter(Boolean)

  // Embeddingモデルの制限（8191トークン）を考慮して制限
  return parts.join('\n\n').slice(0, 8000)
}
```

---

## 7. 完全な使用例

### 作品をインデックスに追加

```typescript
// apps/api/routes/ingest/work.post.ts
import { embedText, prepareSearchableText } from '../../utils/ai/embedding'
import { upsertVector } from '../../utils/db/pinecone'
import { analyzeImage } from '../../utils/ai/vision'

export default defineEventHandler(async (event) => {
  const artistId = await requireAuth(event)
  const formData = await readFormData(event)
  // ... バリデーション

  // 1. 画像をStorageにアップロード
  const imageUrl = await uploadImage(...)

  // 2. Claude Visionで画像分析
  const imageAnalysis = await analyzeImage(imageUrl, { title: metadata.title })

  // 3. 検索用テキスト構築
  const searchableText = prepareSearchableText({
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    imageDescription: imageAnalysis.searchableDescription
  })

  // 4. Embedding生成
  const embedding = await embedText(searchableText)

  // 5. Pineconeにインデックス
  await upsertVector(artistId, `work_${workId}`, embedding, {
    artistId,
    type: 'work',
    sourceId: workId,
    title: metadata.title,
    category: metadata.category,
    tags: [...(metadata.tags || []), ...imageAnalysis.meta.suggestedTags],
    colors: imageAnalysis.visual.dominantColors,
    style: imageAnalysis.visual.style,
    mood: imageAnalysis.content.mood,
    text: searchableText.slice(0, 1000),
    createdAt: new Date().toISOString()
  })

  return { success: true, workId }
})
```

### RAG検索

```typescript
// apps/api/utils/rag/search.ts
import { embedText } from '../ai/embedding'
import { searchSimilar, type SearchResult } from '../db/pinecone'

export interface RAGResult {
  type: 'work' | 'article' | 'podcast'
  sourceId: string
  title: string
  score: number
  snippet: string
}

export async function searchRelevantContent(
  artistId: string,
  query: string,
  options: {
    topK?: number
    types?: ('work' | 'article' | 'podcast')[]
    minScore?: number
  } = {}
): Promise<RAGResult[]> {
  const { topK = 5, types, minScore = 0.7 } = options

  // クエリをEmbedding化
  const queryEmbedding = await embedText(query)

  // フィルター構築
  const filter = types?.length
    ? { type: { $in: types } }
    : undefined

  // 検索実行
  const results = await searchSimilar(artistId, queryEmbedding, {
    topK,
    filter
  })

  // スコアフィルタリング & 整形
  return results
    .filter(r => r.score >= minScore)
    .map(r => ({
      type: r.metadata!.type,
      sourceId: r.metadata!.sourceId,
      title: r.metadata!.title,
      score: r.score,
      snippet: r.metadata!.text.slice(0, 200) + '...'
    }))
}
```

---

## 8. フィルター構文

Pineconeのメタデータフィルターは MongoDB風の構文を使用:

### 比較演算子

```typescript
// 等価
{ field: { $eq: 'value' } }

// 不等価
{ field: { $ne: 'value' } }

// 大小比較
{ field: { $gt: 10 } }   // greater than
{ field: { $gte: 10 } }  // greater than or equal
{ field: { $lt: 10 } }   // less than
{ field: { $lte: 10 } }  // less than or equal
```

### 配列演算子

```typescript
// 配列内に存在
{ field: { $in: ['a', 'b', 'c'] } }

// 配列内に存在しない
{ field: { $nin: ['x', 'y'] } }
```

### 論理演算子

```typescript
// AND
{ $and: [{ type: { $eq: 'work' } }, { style: { $eq: '和風' } }] }

// OR
{ $or: [{ mood: { $eq: '静謐' } }, { mood: { $eq: '幻想的' } }] }
```

### 使用例

```typescript
// 和風スタイルの作品のみ検索
const results = await searchSimilar(artistId, embedding, {
  filter: {
    $and: [
      { type: { $eq: 'work' } },
      { style: { $eq: '和風' } }
    ]
  }
})

// 青または緑の色を含む作品
const results = await searchSimilar(artistId, embedding, {
  filter: {
    colors: { $in: ['青', '緑', '水色'] }
  }
})
```

---

## 9. コスト最適化

### バッチ処理

```typescript
// 複数ベクトルを一括アップロード（最大100件/リクエスト）
export async function upsertVectorsBatch(
  artistId: string,
  vectors: Array<{
    id: string
    embedding: number[]
    metadata: VectorMetadata
  }>
): Promise<void> {
  const index = getIndex()
  const BATCH_SIZE = 100

  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE)

    await index.namespace(artistId).upsert(
      batch.map(v => ({
        id: v.id,
        values: v.embedding,
        metadata: v.metadata
      }))
    )
  }
}
```

### メタデータサイズ削減

```typescript
// メタデータは40KBまで。textフィールドを1000文字に制限
const metadata: VectorMetadata = {
  // ...
  text: searchableText.slice(0, 1000)  // 制限
}
```

---

## 10. トラブルシューティング

### よくあるエラー

| エラー | 原因 | 対処 |
|--------|------|------|
| `Invalid API key` | APIキーが無効 | Console で再生成 |
| `Index not found` | Index名が間違っている | PINECONE_INDEX を確認 |
| `Dimension mismatch` | Embedding次元が違う | 3072次元で統一 |
| `Metadata too large` | 40KB超過 | textフィールドを削減 |

### デバッグ用エンドポイント

```typescript
// apps/api/routes/debug/pinecone.get.ts
export default defineEventHandler(async () => {
  try {
    const stats = await getIndexStats()
    return {
      success: true,
      stats
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
```

---

## 11. 参考リンク

- [Pinecone Documentation](https://docs.pinecone.io/)
- [Pinecone Node.js Client](https://github.com/pinecone-io/pinecone-ts-client)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
