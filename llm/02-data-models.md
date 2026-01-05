# データモデル設計

## Firestore コレクション構造

```
firestore/
├── artists/                    # アーティスト情報
│   └── {artistId}/
│       ├── profile             # 基本プロフィール
│       ├── persona             # ペルソナ設定
│       └── settings            # エージェント設定
├── works/                      # 作品情報
│   └── {workId}/
├── articles/                   # 記事・ブログ
│   └── {articleId}/
├── podcasts/                   # ポッドキャスト
│   └── {podcastId}/
├── conversations/              # チャット履歴
│   └── {conversationId}/
│       └── messages/           # サブコレクション
│           └── {messageId}/
└── quotes/                     # 見積もり履歴
    └── {quoteId}/
```

---

## TypeScript 型定義

### Artist (アーティスト)

```typescript
// types/artist.ts

export interface Artist {
  id: string
  createdAt: Timestamp
  updatedAt: Timestamp

  // 基本情報
  profile: ArtistProfile

  // ペルソナ設定
  persona: ArtistPersona

  // エージェント設定
  settings: AgentSettings
}

export interface ArtistProfile {
  name: string
  nameKana?: string
  email: string
  bio: string                    // 経歴紹介文
  website?: string
  socialLinks: {
    twitter?: string
    instagram?: string
    behance?: string
  }
  profileImageUrl?: string
  coverImageUrl?: string

  // 活動情報
  location?: string
  activeYears: number            // 活動年数
  specialties: string[]          // 専門分野 ['イラスト', '壁画', 'グラフィック']
  styles: string[]               // スタイル ['和風', 'ポップ', 'ミニマル']
}

export interface ArtistPersona {
  // キャラクター設定
  characterName?: string         // エージェントの名前（任意）
  motif: string                  // モチーフ ('カエル', '桜', '波')
  tone: PersonaTone              // 話し方
  personality: string[]          // 性格特性 ['フレンドリー', '知的', 'ユーモラス']

  // 思考・価値観
  artisticPhilosophy: string     // 創作哲学
  influences: string[]           // 影響を受けた作家・文化
  keywords: string[]             // 重要なキーワード

  // 応答スタイル
  greetingStyle: string          // 挨拶の仕方
  sampleResponses: SampleResponse[]  // 理想的な応答例
  avoidTopics: string[]          // 避けるべきトピック

  // 背景ストーリー
  backstory: string              // バックストーリー（長文可）
}

export type PersonaTone =
  | 'formal'        // 丁寧・フォーマル
  | 'friendly'      // フレンドリー
  | 'artistic'      // 芸術的・詩的
  | 'professional'  // ビジネスライク
  | 'playful'       // 遊び心のある

export interface SampleResponse {
  situation: string              // 状況説明
  customerMessage: string        // 顧客の発言例
  idealResponse: string          // 理想的な応答
}

export interface AgentSettings {
  // 営業設定
  isActive: boolean              // エージェント稼働中か
  autoReply: boolean             // 自動返信有効か
  replyDelay?: number            // 返信遅延（秒）- 人間らしさ演出

  // 価格設定
  priceTable: PriceTable
  currency: 'JPY' | 'USD'

  // スケジュール
  availableDays: number[]        // 0=日曜 ~ 6=土曜
  busyPeriods: BusyPeriod[]      // 繁忙期
  leadTime: number               // 最短納期（日数）

  // 通知設定
  notifyOnNewConversation: boolean
  notifyOnQuoteRequest: boolean
  notificationEmail?: string
}

export interface PriceTable {
  illustration: {
    small: number    // ~A4
    medium: number   // ~A2
    large: number    // A1~
  }
  mural: {
    perSquareMeter: number
    minimumCharge: number
  }
  collaboration: {
    hourlyRate: number
    minimumHours: number
  }
  // カスタム項目
  custom: {
    [key: string]: number
  }
}

export interface BusyPeriod {
  startDate: Timestamp
  endDate: Timestamp
  reason?: string
}
```

### Work (作品)

```typescript
// types/work.ts

export interface Work {
  id: string
  artistId: string
  createdAt: Timestamp
  updatedAt: Timestamp

  // 基本情報
  title: string
  titleEn?: string
  description: string
  descriptionEn?: string

  // カテゴリ・タグ
  category: WorkCategory
  tags: string[]
  styles: string[]

  // メディア
  images: WorkImage[]
  videoUrl?: string

  // メタデータ
  year: number
  medium: string               // '油彩', 'デジタル', 'ミクストメディア'
  dimensions?: {
    width: number
    height: number
    unit: 'cm' | 'inch' | 'px'
  }

  // 販売・依頼情報
  isForSale: boolean
  price?: number
  isCommissionable: boolean    // 類似作品の依頼を受けるか

  // 公開設定
  isPublic: boolean
  isFeatured: boolean          // 代表作として強調

  // RAG用
  embeddingId?: string         // Pinecone vector ID
  searchableText: string       // 検索用テキスト（title + description + tags）
}

export type WorkCategory =
  | 'illustration'
  | 'painting'
  | 'mural'
  | 'graphic_design'
  | 'character_design'
  | 'concept_art'
  | 'photography'
  | 'other'

export interface WorkImage {
  url: string
  thumbnailUrl: string
  alt: string
  isPrimary: boolean
  order: number
}
```

### Article (記事)

```typescript
// types/article.ts

export interface Article {
  id: string
  artistId: string
  createdAt: Timestamp
  updatedAt: Timestamp

  // コンテンツ
  title: string
  content: string              // Markdown形式
  excerpt?: string             // 抜粋

  // カテゴリ
  category: ArticleCategory
  tags: string[]

  // メディア
  coverImageUrl?: string

  // 公開設定
  isPublic: boolean
  publishedAt?: Timestamp

  // RAG用
  embeddingId?: string
  searchableText: string
}

export type ArticleCategory =
  | 'process'          // 制作過程
  | 'philosophy'       // 創作哲学
  | 'technique'        // 技法解説
  | 'diary'            // 日記・雑記
  | 'announcement'     // お知らせ
  | 'interview'        // インタビュー
```

### Podcast (ポッドキャスト)

```typescript
// types/podcast.ts

export interface Podcast {
  id: string
  artistId: string
  createdAt: Timestamp
  updatedAt: Timestamp

  // 基本情報
  title: string
  description?: string

  // メディア
  audioUrl: string             // Firebase Storage URL
  duration: number             // 秒数
  coverImageUrl?: string

  // 文字起こし
  transcript?: string          // Whisperで生成
  transcriptStatus: TranscriptStatus

  // 公開設定
  isPublic: boolean
  publishedAt?: Timestamp

  // RAG用
  embeddingId?: string
  searchableText: string       // title + transcript
}

export type TranscriptStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
```

### Conversation (会話)

```typescript
// types/chat.ts

export interface Conversation {
  id: string
  artistId: string
  createdAt: Timestamp
  updatedAt: Timestamp

  // 顧客情報
  customer: {
    name?: string
    email?: string
    company?: string
  }

  // 会話メタデータ
  status: ConversationStatus
  summary?: string             // AIによる要約
  tags: string[]               // ['見積もり依頼', 'イラスト', '急ぎ']

  // 統計
  messageCount: number
  lastMessageAt: Timestamp
}

export type ConversationStatus =
  | 'active'
  | 'waiting_response'         // アーティストの返答待ち
  | 'quote_sent'               // 見積もり送信済み
  | 'closed'
  | 'converted'                // 成約

export interface Message {
  id: string
  conversationId: string
  createdAt: Timestamp

  role: 'user' | 'assistant' | 'system'
  content: string

  // Tool呼び出し結果
  toolCalls?: ToolCallResult[]

  // メタデータ
  tokensUsed?: number
  modelUsed?: string
}

export interface ToolCallResult {
  toolName: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  displayComponent?: string    // 表示に使うVueコンポーネント名
}
```

### Quote (見積もり)

```typescript
// types/quote.ts

export interface Quote {
  id: string
  artistId: string
  conversationId: string
  createdAt: Timestamp
  updatedAt: Timestamp

  // 顧客情報
  customer: {
    name: string
    email: string
    company?: string
  }

  // 見積もり内容
  items: QuoteItem[]
  subtotal: number
  tax: number
  total: number
  currency: 'JPY' | 'USD'

  // 条件
  validUntil: Timestamp
  deliveryDate?: Timestamp
  notes?: string

  // ステータス
  status: QuoteStatus
  sentAt?: Timestamp
  respondedAt?: Timestamp
}

export interface QuoteItem {
  description: string
  category: string
  quantity: number
  unitPrice: number
  amount: number
}

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
```

---

## Pinecone Vector Index 構造

```typescript
// Pinecone Index: ego-graphica

// Namespace: {artistId}
// 各アーティストごとにNamespaceを分離

interface PineconeVector {
  id: string                    // work_{workId} | article_{articleId} | podcast_{podcastId}
  values: number[]              // 1536次元 (text-embedding-3-small)
  metadata: {
    artistId: string
    type: 'work' | 'article' | 'podcast'
    sourceId: string            // Firestoreドキュメント ID
    title: string
    category?: string
    tags: string[]
    createdAt: string           // ISO 8601

    // 検索用テキスト（トランケート版）
    text: string                // max 1000 chars
  }
}
```

---

## インデックス設計

### Firestore Indexes

```
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "works",
      "fields": [
        { "fieldPath": "artistId", "order": "ASCENDING" },
        { "fieldPath": "isPublic", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "conversations",
      "fields": [
        { "fieldPath": "artistId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```
