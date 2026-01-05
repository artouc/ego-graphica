# egoGraphica 現在の実装設計書

このドキュメントは、フロントエンド・バックエンド・シェアパッケージを再構築する際のリファレンスとして使用するために、現在の実装を網羅的に記載したものです。

---

## 1. プロジェクト構成

### 1.1 モノレポ構造

```
egoGraphica/
├── apps/
│   ├── api/          # Nitro.js バックエンドAPI
│   └── web/          # Nuxt.js 4 フロントエンド
├── packages/
│   └── shared/       # 共有型定義・スキーマ・ユーティリティ
├── llm/              # LLM関連ドキュメント
├── package.json      # ルートpackage.json (turbo)
└── turbo.json        # Turborepo設定
```

### 1.2 パッケージ管理

- **パッケージマネージャー**: npm@11.3.0
- **モノレポツール**: Turborepo 2.3.0
- **TypeScript**: 5.6.0

---

## 2. バックエンド (apps/api)

### 2.1 技術スタック

- **フレームワーク**: Nitro.js
- **デプロイ先**: Vercel (preset: vercel)
- **データベース**: Firebase Firestore / Firebase Storage
- **ベクトルDB**: Pinecone
- **AI API**:
  - Anthropic Claude (claude-sonnet-4-5-20250514)
  - OpenAI (text-embedding-3-large, whisper-1)

### 2.2 環境変数

```env
# Anthropic
ANTHROPIC_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Pinecone
PINECONE_API_KEY=
PINECONE_INDEX=egographica

# Firebase Admin
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=

# URLs
NUXT_PUBLIC_API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
```

### 2.3 APIエンドポイント

#### アーティスト管理

| Method | Path | 説明 |
|--------|------|------|
| POST | `/artist` | アーティスト新規登録 |
| GET | `/artist/:id` | アーティスト情報取得 |
| GET | `/artist/persona` | ペルソナ設定取得 |
| PUT | `/artist/persona` | ペルソナ設定更新 |
| GET | `/artist/storage` | ストレージ設定取得 |
| PUT | `/artist/storage` | ストレージ設定更新 |

#### データ取り込み (Ingest)

| Method | Path | 説明 | 入力 |
|--------|------|------|------|
| POST | `/ingest/work` | 作品画像取り込み | FormData: images[], metadata |
| POST | `/ingest/document` | PDFドキュメント取り込み | FormData: document, metadata |
| POST | `/ingest/podcast` | 音声ファイル取り込み | FormData: audio, metadata |
| POST | `/ingest/url` | URLスクレイピング | JSON: url, title?, tags? |
| POST | `/ingest/article` | 記事取り込み | JSON: title, content, tags? |

#### チャット

| Method | Path | 説明 |
|--------|------|------|
| POST | `/chat` | ストリーミングチャット |

#### 分析

| Method | Path | 説明 |
|--------|------|------|
| POST | `/analyze/image` | 画像分析 (Claude Vision) |
| POST | `/analyze/pdf` | PDF分析 (Claude Visual PDFs) |

#### データ取得

| Method | Path | 説明 |
|--------|------|------|
| GET | `/works` | 作品一覧 |
| GET | `/articles` | 記事一覧 |
| GET | `/podcasts` | ポッドキャスト一覧 |

#### システム

| Method | Path | 説明 |
|--------|------|------|
| GET | `/health` | ヘルスチェック |
| GET | `/debug/pinecone` | Pinecone統計 |
| GET | `/dashboard/stats` | ダッシュボード統計 |

### 2.4 ユーティリティモジュール

#### `utils/ai/embedding.ts`
- `embedText(text)` - テキストをベクトル化 (OpenAI text-embedding-3-large, 3072次元)
- `embedTexts(texts)` - バッチ埋め込み
- `prepareSearchableText(params)` - 検索用テキスト準備

#### `utils/ai/vision.ts`
- `analyzeImage(imageUrl, metadata?)` - 画像分析 (Claude Vision)
- `analyzeImageBase64(base64, mediaType, metadata?)` - Base64画像分析
- `buildMultimodalSearchText(params)` - マルチモーダル検索テキスト構築

#### `utils/db/firebase.ts`
- `getDb()` - Firestore インスタンス取得
- `getAdminStorage()` - Firebase Storage インスタンス取得

#### `utils/db/pinecone.ts`
- `getPinecone()` - Pinecone クライアント取得
- `getIndex()` - インデックス取得
- `upsertVector(namespace, id, embedding, metadata)` - ベクトル追加
- `searchSimilar(namespace, embedding, options)` - 類似検索
- `searchByType(namespace, embedding, type, topK)` - タイプ別検索
- `searchByVisual(namespace, embedding, options)` - ビジュアル属性検索
- `deleteVector(namespace, id)` - ベクトル削除
- `deleteNamespace(namespace)` - ネームスペース全削除

#### `utils/rag/search.ts`
- `searchRelevantContent(artistId, query, options)` - RAG検索
- `buildRAGContext(results)` - コンテキスト構築
- `visualSearch(artistId, options)` - ビジュアル検索

#### `utils/persona/index.ts`
- `getArtistPersona(artistId)` - アーティストペルソナ取得
- `buildSystemPrompt(context, ragContext)` - システムプロンプト構築
- `getDefaultPersonaContext(artistId)` - デフォルトペルソナ

#### `utils/artist/storage.ts`
- `getArtistStorageSettings(artistId)` - ストレージ設定取得

#### `utils/auth.ts`
- `requireAuth(event)` - 認証チェック

### 2.5 データ処理フロー

#### 作品アップロード (`/ingest/work`)

```
1. 認証チェック
2. 画像ファイルとメタデータ取得
3. Firebase Storage へアップロード ({storageFolderName}/{workId}/{filename})
4. Claude Vision で画像分析
5. 検索用テキスト構築 (buildMultimodalSearchText)
6. Firestore へ保存 (works コレクション)
7. OpenAI で埋め込み生成
8. Pinecone へインデックス ({pineconeNamespace})
```

#### PDFドキュメント (`/ingest/document`)

```
1. 認証チェック
2. PDFとメタデータ取得
3. Claude Visual PDFs で分析 (pdfs-2024-09-25 beta)
4. Firebase Storage へアップロード ({storageFolderName}/raw/{filename})
5. 検索用テキスト構築
6. Firestore へ保存 (documents コレクション)
7. 埋め込み生成・Pinecone インデックス
```

#### 音声ファイル (`/ingest/podcast`)

```
1. 認証チェック
2. 音声ファイルとメタデータ取得
3. Firebase Storage へアップロード
4. Firestore へ初期レコード保存 (status: processing)
5. OpenAI Whisper で文字起こし
6. 検索用テキスト構築
7. Firestore 更新 (transcript, status: transcribed)
8. 埋め込み生成・Pinecone インデックス
```

#### URLスクレイピング (`/ingest/url`)

```
1. 認証チェック
2. URLをフェッチ
3. Claude で HTML 分析・本文抽出
4. Firestore へ保存:
   - artists/{artistId}/from-url/{urlId} (サブコレクション)
   - urls/{urlId} (グローバルコレクション)
5. 埋め込み生成・Pinecone インデックス
```

### 2.6 チャット処理フロー

```
1. リクエスト検証 (ChatRequestSchema)
2. 最後のユーザーメッセージ抽出
3. 画像添付チェック → Claude Vision で分析
4. 並列処理:
   - ペルソナ取得 (getArtistPersona)
   - RAG検索 (searchRelevantContent)
5. システムプロンプト構築 (buildSystemPrompt)
6. Vercel AI SDK でストリーミングレスポンス
```

---

## 3. フロントエンド (apps/web)

### 3.1 技術スタック

- **フレームワーク**: Nuxt.js 4
- **UIライブラリ**: Nuxt UI 4
- **バリデーション**: Zod

### 3.2 ページ構成

#### `pages/index.vue` - アーティスト登録

```
機能:
- アーティスト名入力
- バケット名入力 (自動生成機能あり)
- POST /artist でアーティスト作成
- 成功時 /upload へリダイレクト

バリデーション:
- artist_name: 必須
- bucket_name: 必須、小文字英数字とハイフンのみ
```

#### `pages/upload.vue` - 情報提供（ファイルアップロード）

```
機能:
- ドラッグ&ドロップ / クリックでファイル選択
- 対応形式: PDF, MP3, M4A, WAV, JPG, PNG
- 複数ファイル同時アップロード
- ファイルタイプ別アイコン表示

処理分岐:
- PDF → POST /ingest/document
- 音声 → POST /ingest/podcast
- 画像 → POST /ingest/work
```

#### `pages/url.vue` - URL提供

```
機能:
- URL入力フォーム
- スクレイピング実行
- 取得済みURL一覧表示 (タイトル、URL、要約)

API:
- POST /ingest/url
```

### 3.3 コンポーネント

使用している Nuxt UI コンポーネント:
- `UCard` - カードコンテナ
- `UForm` / `UFormField` - フォーム
- `UInput` - テキスト入力
- `UButton` - ボタン
- `UIcon` - アイコン

### 3.4 状態管理

- `useRuntimeConfig()` - 環境変数 (apiUrl)
- `useToast()` - トースト通知
- `useRouter()` - ルーティング

---

## 4. 共有パッケージ (packages/shared)

### 4.1 型定義 (`src/types/`)

#### `artist.ts`

```typescript
// 主要な型
Artist                // アーティスト全体
StorageSettings       // ストレージ設定
ArtistProfile         // プロフィール
ArtistPersona         // AIペルソナ
AgentSettings         // エージェント設定
PriceTable            // 価格表
BusyPeriod            // 繁忙期間
SampleResponse        // サンプル応答

// 型リテラル
PersonaTone = "formal" | "friendly" | "artistic" | "professional" | "playful"
```

#### `chat.ts`

```typescript
Conversation          // 会話
ConversationStatus    // 会話ステータス
Message               // メッセージ
MessageContent        // メッセージコンテンツ
ToolCallResult        // ツール呼び出し結果
Quote                 // 見積もり
QuoteItem             // 見積もり項目
QuoteStatus           // 見積もりステータス
```

#### `work.ts`

```typescript
Work                  // 作品
WorkCategory          // 作品カテゴリ
WorkImage             // 作品画像
ImageAnalysis         // 画像分析結果
```

#### `api.ts`

```typescript
// リクエスト/レスポンス型
ChatRequest
ChatMessage
ChatResponse
WorkUploadRequest
WorkUploadResponse
ArtistResponse
HealthResponse
ErrorResponse
```

### 4.2 Zodスキーマ (`src/schemas/`)

#### `artist.ts`

```typescript
PersonaToneSchema
SampleResponseSchema
ArtistPersonaSchema
PriceTableSchema
AgentSettingsSchema
StorageSettingsSchema

// 作成用 (緩いバリデーション)
ArtistProfileCreateSchema
ArtistPersonaCreateSchema
ArtistCreateSchema
```

#### `chat.ts`

```typescript
MessageContentSchema
ChatMessageSchema
ChatRequestSchema
```

#### `work.ts`

```typescript
WorkCategorySchema
WorkUploadSchema
```

### 4.3 ユーティリティ (`src/utils/`)

#### `format.ts`

```typescript
formatPrice(price, currency)     // 価格フォーマット
formatDate(date, locale)         // 日付フォーマット
formatDateTime(date, locale)     // 日時フォーマット
truncate(text, maxLength)        // テキスト切り詰め
```

### 4.4 メッセージ (`src/messages/`)

#### `error.ts`

```typescript
error_messages = {
    work_ingest_failed,
    article_ingest_failed,
    podcast_ingest_failed,
    image_analysis_failed,
    pdf_analysis_failed,
    context_load_failed,
    save_failed,
    auth_token_missing,
    auth_token_invalid,
    // ... 他多数
}

logError(key, error?)            // エラーログ
getErrorMessage(key, details?)   // エラーメッセージ取得
```

#### `log.ts`

```typescript
log_messages = {
    server_starting,
    server_started,
    work_ingest_started,
    work_ingest_completed,
    // ... 他多数
}

logInfo(key, details?)           // 情報ログ
logDebug(key, details?)          // デバッグログ
getLogMessage(key, details?)     // ログメッセージ取得
```

---

## 5. データベース設計

### 5.1 Firestore コレクション

#### `artists` コレクション

```typescript
{
    profile: {
        name: string
        nameKana?: string
        email: string
        bio: string
        website?: string
        socialLinks: { twitter?, instagram?, behance? }
        profileImageUrl?: string
        coverImageUrl?: string
        activeYears: number
        specialties: string[]
        styles: string[]
    }
    persona: {
        characterName?: string
        motif: string
        tone: PersonaTone
        personality: string[]
        artisticPhilosophy: string
        influences: string[]
        keywords: string[]
        greetingStyle: string
        sampleResponses: SampleResponse[]
        avoidTopics: string[]
        backstory: string
    }
    storageSettings: {
        pineconeNamespace: string
        storageFolderName: string
    }
    settings: {
        isActive: boolean
        autoReply: boolean
        replyDelay?: number
        priceTable: PriceTable
        currency: "JPY" | "USD"
        availableDays: number[]
        busyPeriods: BusyPeriod[]
        leadTime: number
        notifyOnNewConversation: boolean
        notifyOnQuoteRequest: boolean
        notificationEmail?: string
    }
    createdAt: Date
    updatedAt: Date
}
```

#### `works` コレクション

```typescript
{
    artistId: string
    title: string
    description: string
    category: string
    tags: string[]
    images: Array<{
        url: string
        filename: string
        size: number
        mimeType: string
    }>
    primaryImage: string
    imageAnalysis: ImageAnalysis
    searchableText: string
    status: "published" | "draft"
    createdAt: Date
    updatedAt: Date
}
```

#### `documents` コレクション

```typescript
{
    artistId: string
    title: string
    description: string
    originalFilename: string
    fileUrl: string
    storagePath: string
    analysis: DocumentAnalysis
    tags: string[]
    category: string
    searchableText: string
    createdAt: Date
    updatedAt: Date
}
```

#### `podcasts` コレクション

```typescript
{
    artistId: string
    title: string
    description: string
    tags: string[]
    audioUrl: string
    duration: number
    transcript: string
    searchableText: string
    status: "processing" | "transcribed" | "failed"
    error?: string
    createdAt: Date
    updatedAt: Date
}
```

#### `urls` コレクション (グローバル)

```typescript
{
    artistId: string
    url: string
    title: string
    mainContent: string
    summary: string
    keyPoints: string[]
    tags: string[]
    category: string
    language: string
    searchableText: string
    createdAt: Date
    updatedAt: Date
}
```

#### `artists/{artistId}/from-url` サブコレクション

- 上記 `urls` と同じスキーマ
- アーティスト別アクセス用

### 5.2 Firebase Storage 構造

```
{storageFolderName}/
├── raw/                    # 元ファイル保存
│   ├── document1.pdf
│   ├── document2.pdf
│   └── .keep
└── {workId}/               # 作品画像
    ├── 0_image1.jpg
    └── 1_image2.png

podcasts/
└── {storageFolderName}/
    └── {podcastId}/
        └── audio.mp3

works/
└── {storageFolderName}/
    └── {workId}/
        └── 0_image.jpg
```

### 5.3 Pinecone 構造

- **インデックス名**: `egographica`
- **次元数**: 3072 (text-embedding-3-large)
- **ネームスペース**: アーティストごと (`storageSettings.pineconeNamespace`)

#### メタデータスキーマ

```typescript
{
    artistId: string
    type: "work" | "article" | "podcast"
    sourceId: string
    title: string
    category?: string
    tags: string[]
    colors?: string[]       // 作品のみ
    style?: string          // 作品のみ
    mood?: string           // 作品のみ
    text: string            // 最大1000文字
    createdAt: string       // ISO形式
}
```

---

## 6. AI処理設計

### 6.1 画像分析 (Claude Vision)

**モデル**: `claude-sonnet-4-20250514`

**出力フォーマット**:
```typescript
{
    visual: {
        dominantColors: string[]    // 主要な色3つ
        colorMood: string           // 色の印象
        composition: string         // 構図の特徴
        style: string               // アートスタイル
        technique: string           // 技法・画材
    }
    content: {
        subject: string             // 主題・モチーフ
        elements: string[]          // 要素リスト
        mood: string                // 雰囲気
        narrative: string           // 物語性 (2-3文)
    }
    meta: {
        suggestedTags: string[]     // 推奨タグ5つ
        similarStyles: string[]     // 類似スタイル
        targetAudience: string      // ターゲット層
        useCase: string[]           // 推奨用途
    }
    searchableDescription: string   // 検索用説明 (100-200字)
}
```

### 6.2 PDF分析 (Claude Visual PDFs)

**モデル**: `claude-sonnet-4-5-20250514`
**Beta**: `pdfs-2024-09-25`

**出力フォーマット**: 画像分析と同じ構造 + `suggestedTitle`, `suggestedCategory`

### 6.3 音声文字起こし (Whisper)

**モデル**: `whisper-1`
**言語**: `ja` (日本語)

### 6.4 埋め込み (OpenAI)

**モデル**: `text-embedding-3-large`
**次元数**: 3072

### 6.5 チャット (Claude with Vercel AI SDK)

**モデル**: `claude-sonnet-4-20250514`
**最大トークン**: 4096
**温度**: 0.7

---

## 7. ペルソナシステム

### 7.1 システムプロンプト構造

```
# あなたの役割
- AI営業アシスタントとしての役割定義

# キャラクター設定
- 基本情報 (名前、活動年数、専門分野、スタイル)
- ペルソナ (モチーフ、トーン、性格)
- 創作哲学
- 影響を受けたもの
- バックストーリー

# コミュニケーションスタイル
- 話し方の指針 (トーン別)
- 挨拶スタイル
- キーワード
- 理想的な応答例

# 営業情報
- 価格目安
- 納期
- 対応可能日

# 禁止事項
- 避けるべきトピック
- 禁止行動

# 参照コンテンツ (RAG)
- 関連コンテンツリスト

# 応答の指針
- 5つの指針
```

### 7.2 トーン設定

| トーン | 説明 | 話し方 |
|--------|------|--------|
| formal | 丁寧でフォーマル | ビジネス敬語、落ち着いた表現 |
| friendly | フレンドリーで親しみやすい | です・ます調ベース、くだけた表現 |
| artistic | 芸術的で詩的 | 比喩、感覚的な言葉選び |
| professional | プロフェッショナルでビジネスライク | 明確で簡潔、数字や具体例 |
| playful | 遊び心のあるユーモラス | ユーモア、カジュアル |

---

## 8. 命名規則

### 8.1 コード規則

- 変数名: `snake_case`
- 関数名: `camelCase`
- 型名: `PascalCase`
- 環境変数: `CONSTANT_CASE`
- インデント: スペース4つ
- 引用符: ダブルクォーテーション優先
- セミコロン: 不要な箇所には記載しない

### 8.2 ID生成

```typescript
// 作品ID
`work_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// ドキュメントID
`doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// ポッドキャストID
`podcast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// URL ID
`url_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
```

### 8.3 ベクトルID

```typescript
// Pineconeベクトル
`work_${workId}`
`doc_${documentId}`
`podcast_${podcastId}`
`url_${urlId}`
```

---

## 9. エラーハンドリング

### 9.1 共通パターン

```typescript
try {
    // 処理
} catch (error) {
    // H3エラーの場合はそのまま再throw
    if (error && typeof error === "object" && "statusCode" in error) {
        throw error
    }

    // 共通エラーログ
    logError("operation_failed", error)

    // クリーンアップ
    try {
        // 失敗時のロールバック処理
    } catch {}

    // エラーレスポンス
    throw createError({
        statusCode: 500,
        message: error instanceof Error ? error.message : "Operation failed"
    })
}
```

### 9.2 HTTPステータスコード

| コード | 使用場面 |
|--------|----------|
| 400 | バリデーションエラー、必須フィールド不足 |
| 401 | 認証エラー |
| 404 | リソース未発見 |
| 409 | 競合 (既存リソース) |
| 500 | サーバーエラー |

---

## 10. 今後の再構築に向けた注意点

### 10.1 維持すべき設計

1. **ネームスペース分離**: アーティストごとのPineconeネームスペース
2. **マルチモーダルRAG**: 画像分析→テキスト化→埋め込み
3. **ペルソナシステム**: トーン別のシステムプロンプト構築
4. **メッセージ一元管理**: エラー・ログメッセージの集中管理

### 10.2 改善すべき点

1. 認証システムの本格実装 (現在はdemo-artistフォールバック)
2. エラーメッセージの多言語対応
3. バッチ処理の非同期化 (特に音声文字起こし)
4. テスト追加

### 10.3 依存関係

```
@egographica/shared は以下で使用:
- apps/api (型、スキーマ、メッセージ)
- apps/web (型、スキーマ)
```
