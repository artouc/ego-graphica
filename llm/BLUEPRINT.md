# egoGraphica - 設計ドキュメント

> このドキュメントは `llm/` 内の全ドキュメントを統合したものです。

---

# 1. プロジェクト概要

アーティストの代わりに営業を行う自律型AIエージェント。アーティストの作品、記事、ポッドキャスト音声等を学習し、アーティスト固有の思考パターンとペルソナを反映した顧客対応を実現する。

## コンセプト

アーティストの創作物とペルソナ設定を基にAI営業エージェントを構築し、顧客対応を自動化する。

## 主要機能

| 機能 | 説明 |
|------|------|
| RAG | 作品・記事からの関連情報検索 |
| CAG | アーティストペルソナの文脈注入 |
| Tool Calling | 見積もり生成、スケジュール確認、ポートフォリオ表示 |
| Embedding | コンテンツのベクトル化・類似検索 |
| 音声文字起こし | ポッドキャスト等の音声コンテンツ処理 |
| Multimodal RAG | Claude Visionによる画像理解・視覚的類似検索 |

## アーキテクチャ全体図（Monorepo構成）

pnpm workspaceによるMonorepo構成。

**apps/web (Nuxt 4)**: UI Components、Pages (SSR)、@ai-sdk/vueを含むフロントエンド。

**apps/api (Nitro Server)**: /chat (Stream)、/ingest/*エンドポイント、firebase-admin、RAG Pipelineを含むバックエンド。

**packages/shared**: 型定義とZodスキーマを格納する共有パッケージ。apps/webとapps/apiの両方から参照される。

**外部サービス**: Firebase (Auth/DB/Storage)、Pinecone (Vector Index)、Claude 4.5 Opus (Vision)と連携。

---

# 2. 技術スタック

## コア技術

### フロントエンド (apps/web)

| 役割 | 技術 | バージョン | 理由 |
|------|------|-----------|------|
| フレームワーク | **Nuxt 4** | 4.x | SSR/SSG、Vue 3.5+対応 |
| AI Chat UI | **Vercel AI SDK** | 4.x | `@ai-sdk/vue`でuseChat対応 |
| スタイリング | **CSS** | - | シンプルに開始、後からTailwind追加可 |

### バックエンド (apps/api)

| 役割 | 技術 | バージョン | 理由 |
|------|------|-----------|------|
| サーバー | **Nitro** | 2.x | 軽量、Vercel/Cloudflare対応 |
| バリデーション | **Zod** | 3.x | TypeScript統合、ランタイムチェック |

### LLM & AI

| 役割 | 技術 | モデルID | 理由 |
|------|------|----------|------|
| メインLLM | **Claude 4.5 Opus** | `claude-opus-4-5-20250514` | 最高品質のペルソナ維持、200Kコンテキスト |
| Embedding | **OpenAI** | `text-embedding-3-large` | 3072次元、高精度 |
| 音声文字起こし | **OpenAI Whisper** | `whisper-1` | 日本語対応、高精度 |

### データベース & ストレージ (firebase-admin のみ)

| 役割 | 技術 | 備考 |
|------|------|------|
| Vector DB | **Pinecone** | Serverless (GCP)、無料枠あり |
| メタデータDB | **Firestore** | firebase-admin経由でサーバーサイドのみ |
| ファイル保存 | **Firebase Storage** | firebase-admin経由でサーバーサイドのみ |
| 認証 | **Firebase Auth** | firebase-admin経由、IDトークン検証 |

> **重要**: クライアント側にFirebase SDKは使用しない。すべてのFirebase操作はAPIサーバー（firebase-admin）経由で行う。

### インフラ & デプロイ

| 役割 | 技術 | 理由 |
|------|------|------|
| ホスティング | **Vercel** | Nuxt/Nitroネイティブ対応 |
| CDN | **Vercel Edge Network** | 自動最適化 |

## Monorepo構成

npm workspacesとTurborepoを使用したMonorepo構成。

- **apps/web**: Nuxt 4によるフロントエンド。nuxt、@ai-sdk/vue、@egographica/sharedに依存。
- **apps/api**: Nitroによるバックエンド。nitropack、firebase-admin（サーバーサイドのみ）、@ai-sdk/anthropic、@pinecone-database/pinecone、@egographica/sharedに依存。
- **packages/shared**: 型定義とZodスキーマを格納する共有パッケージ。

## 環境変数

| 変数名 | 用途 |
|--------|------|
| ANTHROPIC_API_KEY | Claude 4.5 Opus API認証 |
| OPENAI_API_KEY | Embedding & Whisper API認証 |
| PINECONE_API_KEY | Pinecone API認証 |
| PINECONE_INDEX | Pineconeインデックス名 |
| FIREBASE_PROJECT_ID | FirebaseプロジェクトID |
| FIREBASE_CLIENT_EMAIL | Firebase Adminサービスアカウントメール |
| FIREBASE_PRIVATE_KEY | Firebase Admin秘密鍵 |
| NUXT_PUBLIC_API_URL | APIサーバーのURL |
| WEB_URL | WebアプリのURL |

## 認証フロー (firebase-admin)

1. クライアント（Nuxt）からAPIサーバー（Nitro）にログインリクエスト（メール/パスワード）を送信
2. APIサーバーがFirebase Adminでユーザーを検証または作成
3. Firebase AdminがカスタムトークンをAPIサーバーに返却
4. APIサーバーがトークンをクライアントに返却
5. クライアントが以降のAPIリクエストでBearerトークンを付与
6. APIサーバーがFirebase Adminでトークンを検証
7. Firebase Adminがユーザー情報を返却
8. APIサーバーがレスポンスをクライアントに返却

## 認証APIエンドポイント

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/auth/login` | POST | メール/パスワードでログイン |
| `/auth/register` | POST | 新規ユーザー登録 |
| `/auth/verify` | GET | トークン検証 |
| `/auth/refresh` | POST | トークン更新 |

## 技術選定の根拠

### なぜ firebase-admin のみか

1. **セキュリティ**: クライアントにFirebase設定を露出しない
2. **統一的なAPI**: すべてのデータ操作がAPIサーバー経由
3. **キャッシュ制御**: サーバーサイドでキャッシュ戦略を制御可能
4. **監査ログ**: すべての操作をサーバーで記録可能

### なぜ Claude 4.5 Opus か

1. **ペルソナ維持能力**: 長い会話でもキャラクターの一貫性を保持
2. **200Kコンテキスト**: 大量の作品情報・ペルソナ設定を同時注入可能
3. **日本語品質**: 自然な日本語での営業トーク生成
4. **Tool Calling**: 構造化された関数呼び出しに対応

### なぜ Pinecone か

1. **Serverless**: コールドスタートなし、即座にスケール
2. **Namespace**: アーティストごとにデータ分離が容易
3. **無料枠**: 100K vectors/月まで無料
4. **GCP対応**: Firebaseと同じクラウドプロバイダーで統一

---

# 3. データモデル設計

## Firestore コレクション構造

- **artists/{artistId}**: アーティスト情報。profile（基本プロフィール）、persona（ペルソナ設定）、settings（エージェント設定）を含む。
- **works/{workId}**: 作品情報
- **articles/{articleId}**: 記事・ブログ
- **podcasts/{podcastId}**: ポッドキャスト
- **conversations/{conversationId}**: チャット履歴。サブコレクションとしてmessages/{messageId}を持つ。
- **quotes/{quoteId}**: 見積もり履歴

## TypeScript 型定義

### Artist (アーティスト)

ファイル: types/artist.ts

**Artist**: id, createdAt, updatedAt, profile (ArtistProfile), persona (ArtistPersona), settings (AgentSettings)

**ArtistProfile**: name, nameKana?, email, bio（経歴紹介文）, website?, socialLinks (twitter?, instagram?, behance?), profileImageUrl?, coverImageUrl?, location?, activeYears（活動年数）, specialties（専門分野）, styles（スタイル）

**ArtistPersona**: characterName?（エージェント名）, motif（モチーフ）, tone (PersonaTone), personality（性格特性）, artisticPhilosophy（創作哲学）, influences（影響を受けた作家・文化）, keywords, greetingStyle（挨拶の仕方）, sampleResponses (SampleResponse[]), avoidTopics（避けるべきトピック）, backstory（バックストーリー）

**PersonaTone**: "formal"（丁寧）, "friendly", "artistic"（芸術的・詩的）, "professional", "playful"（遊び心のある）

**SampleResponse**: situation（状況説明）, customerMessage（顧客の発言例）, idealResponse（理想的な応答）

**AgentSettings**: isActive（エージェント稼働中か）, autoReply（自動返信有効か）, replyDelay?（返信遅延秒数）, priceTable (PriceTable), currency ("JPY" | "USD"), availableDays（曜日配列）, busyPeriods (BusyPeriod[]), leadTime（最短納期日数）, notifyOnNewConversation, notifyOnQuoteRequest, notificationEmail?

**PriceTable**: illustration (small, medium, large), mural (perSquareMeter, minimumCharge), collaboration (hourlyRate, minimumHours), custom（カスタム項目のキーバリュー）

**BusyPeriod**: startDate, endDate, reason?

### Work (作品)

ファイル: types/work.ts

**Work**: id, artistId, createdAt, updatedAt, title, titleEn?, description, descriptionEn?, category (WorkCategory), tags, styles, images (WorkImage[]), videoUrl?, year, medium（油彩、デジタル等）, dimensions? (width, height, unit), isForSale, price?, isCommissionable（類似作品依頼可否）, isPublic, isFeatured（代表作）, embeddingId?（Pinecone vector ID）, searchableText（検索用テキスト）

**WorkCategory**: "illustration", "painting", "mural", "graphic_design", "character_design", "concept_art", "photography", "other"

**WorkImage**: url, thumbnailUrl, alt, isPrimary, order

### Article (記事)

ファイル: types/article.ts

**Article**: id, artistId, createdAt, updatedAt, title, content（Markdown形式）, excerpt?（抜粋）, category (ArticleCategory), tags, coverImageUrl?, isPublic, publishedAt?, embeddingId?, searchableText

**ArticleCategory**: "process"（制作過程）, "philosophy"（創作哲学）, "technique"（技法解説）, "diary"（日記・雑記）, "announcement"（お知らせ）, "interview"

### Podcast (ポッドキャスト)

ファイル: types/podcast.ts

**Podcast**: id, artistId, createdAt, updatedAt, title, description?, audioUrl（Firebase Storage URL）, duration（秒数）, coverImageUrl?, transcript?（Whisperで生成）, transcriptStatus (TranscriptStatus), isPublic, publishedAt?, embeddingId?, searchableText（title + transcript）

**TranscriptStatus**: "pending", "processing", "completed", "failed"

### Conversation (会話)

ファイル: types/chat.ts

**Conversation**: id, artistId, createdAt, updatedAt, customer (name?, email?, company?), status (ConversationStatus), summary?（AIによる要約）, tags, messageCount, lastMessageAt

**ConversationStatus**: "active", "waiting_response"（アーティストの返答待ち）, "quote_sent"（見積もり送信済み）, "closed", "converted"（成約）

**Message**: id, conversationId, createdAt, role ("user" | "assistant" | "system"), content, toolCalls? (ToolCallResult[]), tokensUsed?, modelUsed?

**ToolCallResult**: toolName, input, output, displayComponent?（表示に使うVueコンポーネント名）

### Quote (見積もり)

ファイル: types/quote.ts

**Quote**: id, artistId, conversationId, createdAt, updatedAt, customer (name, email, company?), items (QuoteItem[]), subtotal, tax, total, currency ("JPY" | "USD"), validUntil, deliveryDate?, notes?, status (QuoteStatus), sentAt?, respondedAt?

**QuoteItem**: description, category, quantity, unitPrice, amount

**QuoteStatus**: "draft", "sent", "accepted", "rejected", "expired"

## Pinecone Vector Index 構造

Index名: ego-graphica。各アーティストごとにNamespace（{artistId}）を分離。

**PineconeVector**: id（work_{workId} | article_{articleId} | podcast_{podcastId}形式）, values（1536次元、text-embedding-3-small）, metadata

**metadata**: artistId, type ("work" | "article" | "podcast"), sourceId（FirestoreドキュメントID）, title, category?, tags, createdAt（ISO 8601）, text（検索用テキスト、max 1000 chars）

## インデックス設計

### Firestore Indexes

ファイル: firestore.indexes.json

**worksコレクション**: artistId (ASC) + isPublic (ASC) + createdAt (DESC)

**conversationsコレクション**: artistId (ASC) + status (ASC) + updatedAt (DESC)

---

# 4. RAG (Retrieval Augmented Generation) 実装

## 概要

RAGを使用して、アーティストの作品・記事・ポッドキャストから関連情報を検索し、回答の文脈として提供する。

処理フロー: ユーザークエリ → Embedding化 → Pinecone検索 → コンテキスト注入 → Claude応答生成

## Embedding パイプライン

### 1. Embeddingユーティリティ

ファイル: server/utils/embedding.ts

OpenAI SDKを使用してtext-embedding-3-smallモデル（1536次元）でEmbeddingを生成。

**embedText(text)**: 単一テキストをEmbedding化し、number[]を返す。

**embedTexts(texts)**: 複数テキストを一括Embedding化し、number[][]を返す。

**prepareSearchableText(params)**: title, description?, tags?, content?を結合し、検索用テキストを生成。最大8000文字に制限。

### 2. Pineconeクライアント

ファイル: server/utils/pinecone.ts

@pinecone-database/pineconeを使用。環境変数PINECONE_API_KEY、PINECONE_INDEXでインデックスに接続。

**VectorMetadata**: artistId, type ("work" | "article" | "podcast"), sourceId, title, category?, tags, text, createdAt

**upsertVector(artistId, id, embedding, metadata)**: artistIdのNamespaceにベクトルを追加/更新。

**deleteVector(artistId, id)**: ベクトルを削除。

**searchSimilar(artistId, queryEmbedding, options?)**: 類似検索を実行。options.topK（デフォルト5）、options.filterでフィルタリング可能。

## 検索実装

### 3. RAG検索サービス

ファイル: server/utils/rag.ts

**RAGResult**: type, sourceId, title, score, snippet, metadata (VectorMetadata), fullData?（Firestoreから取得した詳細データ）

**searchRelevantContent(artistId, query, options?)**: RAG検索のメイン関数。

処理手順:
1. クエリをEmbedding化
2. types指定時はフィルター構築
3. Pinecone検索実行
4. minScore（デフォルト0.7）以上の結果をフィルタリング
5. includeFullData=trueの場合、Firestoreから詳細データを取得

options: topK（デフォルト5）, types?（"work" | "article" | "podcast"の配列）, minScore（デフォルト0.7）, includeFullData（デフォルトfalse）

**buildRAGContext(results)**: RAGResultの配列からチャット用コンテキスト文字列を生成。各結果のタイプラベル（作品/記事/ポッドキャスト）、タイトル、スニペット、関連度スコアを含む。

## チャットAPIでの統合

### 4. メインチャットエンドポイント

ファイル: server/api/chat.post.ts

Vercel AI SDK（streamText）と@ai-sdk/anthropicを使用。

処理手順:
1. リクエストボディからmessages、artistIdを取得
2. 最新のユーザーメッセージを抽出
3. RAG検索とペルソナ取得を並列実行
4. buildRAGContextでコンテキスト構築
5. buildSystemPromptでシステムプロンプト構築（ペルソナ + RAGコンテキスト）
6. Claude 4.5 Opus（claude-opus-4-5-20250514）でストリーミング応答を生成

パラメータ: maxTokens=4096, temperature=0.7, tools=chatTools(artistId)

## 検索の最適化

### ハイブリッド検索（将来拡張）

ファイル: server/utils/hybrid-search.ts

キーワード検索とベクトル検索を組み合わせた検索手法。

**hybridSearch(artistId, query)**: ベクトル検索（意味的類似性、topK=10、minScore=0.6）とキーワード検索（Firestore全文検索 or Algolia）を実行し、RRF（Reciprocal Rank Fusion）でスコア統合。上位5件を返す。

**reciprocalRankFusion(resultSets, k=60)**: 複数の結果セットをRRFアルゴリズムで統合。各結果のランクに基づき 1/(k+rank+1) のスコアを付与し、合計スコアでソート。

### クエリ拡張

ファイル: server/utils/query-expansion.ts

**expandQuery(originalQuery)**: Claude Sonnet（claude-sonnet-4-20250514）を使用してユーザー質問から関連検索キーワードを3つ生成。JSON配列形式で出力。パース失敗時は元のクエリのみ返す。

## インデックス更新フロー

作品追加/更新 → Firestore Trigger (Cloud Functions) → prepareSearchableText() → embedText() → upsertVector() → Pinecone

ファイル: functions/src/index.ts

**onWorkWritten**: works/{workId}のドキュメント変更をトリガーするCloud Function。

- 削除時: deleteVectorでPineconeからベクトル削除
- 追加/更新時: prepareSearchableTextで検索用テキスト生成、embedTextでEmbedding化、upsertVectorでPineconeに保存

metadataにはartistId, type="work", sourceId, title, category, tags, text（max 1000 chars）, createdAtを含む。

---

# 5. CAG (Context Augmented Generation) & ペルソナ設計

## 概要

CAGを使用して、アーティスト固有のペルソナ・思考パターン・バックグラウンドをシステムプロンプトに注入し、一貫したキャラクター性を持つ応答を生成する。

処理フロー: ペルソナ設定 + RAGコンテキスト → システムプロンプト構築 → Claude → パーソナライズされた応答

## ペルソナ構造

### コンポーネント分解

Artist Personaは5つのレイヤーで構成される:

- **Identity Layer**: キャラクター名、モチーフ
- **Communication Layer**: 話し方、トーン、表現スタイル
- **Knowledge Layer**: 専門知識、創作哲学、影響元
- **Behavioral Layer**: 応答パターン、禁止事項
- **Business Layer**: 価格感、納期、営業スタンス

## ペルソナ取得・構築

### 1. ペルソナ取得サービス

ファイル: server/utils/persona.ts

**FullPersonaContext**: profile (ArtistProfile), persona (ArtistPersona), settings (AgentSettings)

**getArtistPersona(artistId)**: Firestoreのartistsコレクションからアーティスト情報を取得し、FullPersonaContextを返す。存在しない場合は404エラーをスロー。

### 2. システムプロンプトビルダー

ファイル: server/utils/prompt-builder.ts

**buildSystemPrompt(context, ragContext)**: FullPersonaContextとRAGコンテキストからシステムプロンプトを構築。

プロンプト構成:
1. 役割定義（AI営業アシスタント、キャラクター名）
2. キャラクター設定（基本情報、ペルソナ、創作哲学、影響元、バックストーリー）
3. コミュニケーションスタイル（話し方指針、挨拶スタイル、キーワード、応答例）
4. 営業情報（価格目安、納期、対応可能日）
5. 禁止事項（避けるべきトピック、禁止行動）
6. RAGコンテキスト（存在する場合）
7. 応答指針（世界観体現、専門知識活用、営業的配慮、親しみやすさ、クロージング意識）

**getToneDescription(tone)**: トーン値を日本語説明に変換。formal→丁寧でフォーマル、friendly→フレンドリーで親しみやすい、artistic→芸術的で詩的、professional→プロフェッショナルでビジネスライク、playful→遊び心のあるユーモラス

**getToneGuidelines(tone)**: トーンに応じた話し方ガイドラインを返す。敬語使用、語尾の柔らかさ、比喩表現、明確さ、ユーモアなど。

**getAvailableDaysText(days)**: 曜日番号配列（0=日〜6=土）を「月・火・水曜日」形式の文字列に変換。

## ペルソナ設定UI

### 3. ペルソナ設定ページ

ファイル: pages/dashboard/persona.vue

ArtistPersona型のデータを編集するフォームページ。

**データ構造**: characterName, motif, tone（デフォルト: "friendly"）, personality, artisticPhilosophy, influences, keywords, greetingStyle, sampleResponses, avoidTopics, backstory

**トーン選択肢**: formal（丁寧・フォーマル）, friendly（フレンドリー）, artistic（芸術的・詩的）, professional（プロフェッショナル）, playful（遊び心のある）

**セクション構成**:
1. キャラクター設定: エージェント名（任意）、モチーフ（必須）、トーン（必須、ラジオボタン）
2. 創作哲学: 創作への考え方（必須）、バックストーリー
3. 理想的な応答例: 状況・顧客メッセージ・理想的応答のセット（動的追加/削除可能）
4. 保存ボタン

**API**: PUT /api/artist/persona でペルソナを保存

## 動的コンテキスト調整

### 4. 会話フェーズに応じたコンテキスト

ファイル: server/utils/dynamic-context.ts

**ConversationPhase**: "greeting"（初回挨拶）, "exploration"（ニーズ探索）, "presentation"（作品紹介）, "negotiation"（条件交渉）, "closing"（クロージング）

**detectConversationPhase(messages)**: メッセージ配列から現在の会話フェーズを判定。

判定ロジック:
- メッセージ数2以下 → greeting
- 直近3メッセージに「見積」「価格」「いくら」を含む → negotiation
- 「作品」「ポートフォリオ」「実績」を含む → presentation
- 「お願い」「依頼」「発注」を含む → closing
- その他 → exploration

**getPhaseSpecificInstructions(phase)**: フェーズに応じた指示文を返す。

- greeting: 温かく歓迎、自己紹介、ニーズを聞く姿勢
- exploration: オープンクエスチョンで深掘り、用途・目的・イメージ確認、予算・納期把握
- presentation: 関連作品を積極的に紹介、Tool Callingで作品表示、顧客反応確認
- negotiation: 価格表参考に概算提示、正式見積もりは別途と補足、納期相談
- closing: 次のステップ明確化、見積もりTool使用、アーティスト本人への引き継ぎ提案

---

# 6. Tool Calling 実装

## 概要

Vercel AI SDKのTool Calling機能を使用して、AIエージェントが外部システムと連携し、以下のアクションを実行可能にする：

- 作品ポートフォリオの表示
- スケジュール空き状況の確認
- 概算見積もりの生成
- 問い合わせフォームの表示

処理フロー: ユーザーメッセージ → Claude分析 → ツール選択 → 実行 → レスポンス整形

## ツール定義

### 1. ツール一覧

ファイル: server/utils/tools.ts

Vercel AI SDKのtool関数とZodを使用。

**chatTools(artistId)**: artistIdに紐づくツールセットを返す。showPortfolio, checkAvailability, generateQuote, showContactForm, searchWorksの5つ。

### 2. ポートフォリオ表示ツール

ファイル: server/utils/tools/portfolio.ts

**showPortfolio**: アーティストの作品ポートフォリオを表示。顧客が作品を見たい、実績を知りたいと言った場合に使用。

パラメータ:
- category?: "illustration" | "painting" | "mural" | "graphic_design" | "character_design" | "concept_art" | "all"
- style?: string（和風、ポップなど）
- limit: number（1-10、デフォルト4）
- featured?: boolean（代表作のみ表示）

処理: FirestoreのworksコレクションからisPublic=trueの作品を取得。category、featuredでフィルタリング。createdAt降順でソート。styleはタグで部分一致フィルタリング。

戻り値: success, works (id, title, category, description, imageUrl, year, tags), count, displayComponent="PortfolioGrid"

### 3. スケジュール確認ツール

ファイル: server/utils/tools/availability.ts

**checkAvailabilityTool(artistId)**: アーティストのスケジュール空き状況を確認。納期の相談や、いつから対応可能かを確認したい場合に使用。

パラメータ:
- month: string（YYYY-MM形式）
- projectType?: "illustration" | "mural" | "collaboration" | "other"

処理: アーティストの設定からbusyPeriodsを取得し繁忙期チェック。quotesコレクションからstatus="accepted"のプロジェクト数を確認。

空き状況判定:
- 繁忙期 → "busy"
- 月内プロジェクト3件以上 → "limited"
- それ以外 → "available"

戻り値: success, month, availability, message, leadTime, existingProjectCount, displayComponent="AvailabilityCalendar"

### 4. 見積もり生成ツール

ファイル: server/utils/tools/quote.ts

**generateQuoteTool(artistId)**: 概算見積もりを生成。価格を知りたい、見積もりが欲しいという場合に使用。正式な見積もりではなく参考価格として提示。

パラメータ:
- projectType: "illustration_small" | "illustration_medium" | "illustration_large" | "mural" | "character_design" | "collaboration"
- description: string（依頼内容の概要）
- quantity: number（デフォルト1）
- rushOrder: boolean（デフォルトfalse、急ぎの場合30%増）
- additionalOptions?: string[]

処理: artistsコレクションからpriceTableを取得。projectTypeに応じた基本価格を計算。数量倍、急ぎ料金（30%増）、消費税10%を加算。

価格マッピング: illustration_small→priceTable.illustration.small, illustration_medium→medium, illustration_large→large, mural→mural.minimumCharge, character_design→medium×1.5, collaboration→hourlyRate×minimumHours

戻り値: success, quote (items, subtotal, tax, total, currency="JPY", validDays=14, notes), displayComponent="QuotePreview"

### 5. 作品検索ツール

ファイル: server/utils/tools/search.ts

**searchWorksTool(artistId)**: 特定のキーワードや要望に合った作品を検索。「こんな感じの作品ありますか？」「〇〇っぽいもの」といった曖昧な要望に対応。

パラメータ:
- query: string（自然言語の検索クエリ）
- types?: ("work" | "article" | "podcast")[]（検索対象の種類）

処理: searchRelevantContent関数でRAGベースのセマンティック検索を実行。topK=5, minScore=0.6, includeFullData=true。

戻り値: success, results (type, title, snippet, relevance, data), count, displayComponent="SearchResults"

### 6. 問い合わせフォーム表示ツール

ファイル: server/utils/tools/contact.ts

**showContactForm**: 正式な問い合わせフォームを表示。詳しい相談をしたい、正式に依頼したいという場合に使用。

パラメータ:
- prefillData?: { projectType?, budget?, deadline?, description? }（フォームの事前入力データ）

戻り値: success, message, prefillData, displayComponent="ContactForm"

## フロントエンド表示コンポーネント

### ToolResultRenderer

ファイル: components/chat/ToolResultRenderer.vue

ツール実行結果を適切なコンポーネントで表示するラッパー。

Props: toolName, result

コンポーネントマッピング:
- PortfolioGrid → ChatPortfolioGrid
- AvailabilityCalendar → ChatAvailabilityCalendar
- QuotePreview → ChatQuotePreview
- SearchResults → ChatSearchResults
- ContactForm → ChatContactForm
- マッチしない場合 → ChatGenericResult

### PortfolioGrid

ファイル: components/chat/ChatPortfolioGrid.vue

作品一覧をグリッド表示。data.worksの各作品について、imageUrl、title、yearを2カラムグリッドで表示。

### QuotePreview

ファイル: components/chat/ChatQuotePreview.vue

概算見積もりをテーブル表示。items（内容、数量、金額）、subtotal、tax、totalを表示。Intl.NumberFormatで通貨フォーマット。notesを注意書きとして表示。

## ツール使用のプロンプト指示

システムプロンプトに追加するツール使用の指針。

**showPortfolio**: 「作品を見たい」「実績は？」「どんな絵を描くの？」といった質問に対応。featured=trueで代表作を優先表示。

**checkAvailability**: 「いつから対応できる？」「〇月は空いてる？」といった質問に対応。納期相談の際に自動で確認。

**generateQuote**: 「いくらくらい？」「見積もりが欲しい」といった質問に対応。必ず「概算」であることを伝える。

**searchWorks**: 「こんな感じのある？」「〇〇っぽいもの」といった曖昧な検索に対応。RAGベースでセマンティック検索。

**showContactForm**: 「正式に依頼したい」「詳しく相談したい」という場合。会話の締めくくりとして提案。

ツールの結果は自動的にUI表示される。結果を受けて、自然な言葉で補足説明を加える。

---

# 7. データ取り込みパイプライン

## 概要

アーティストのコンテンツ（作品、記事、ポッドキャスト）をシステムに取り込み、Embedding化してRAG検索可能にするパイプライン。

処理フロー: Upload → Validation → Storage → Transcription（音声の場合） → Embedding → Indexing

## パイプライン構成

**Data Ingestion Pipeline**:

1. Upload API: ファイルアップロード受付
2. Validate & Store: バリデーション後、Firebase Storageにファイル保存、Firestoreにメタデータ保存
3. Process: Embedding生成、音声の場合は文字起こし（Whisper）
4. Index: Pineconeにベクトルインデックス
5. Search Ready: RAG検索可能状態

## 作品取り込み

### 1. 作品アップロードAPI

ファイル: server/api/ingest/work.post.ts

FormDataでimages（複数画像）とmetadata（JSON文字列）を受け取る。

処理手順:
1. 認証チェック（requireAuth）
2. バリデーション（title必須、images 1枚以上必須）
3. 画像をFirebase Storageにアップロード（artists/{artistId}/works/にパス構成、公開設定）
4. prepareSearchableTextで検索用テキスト生成
5. Firestoreのworksコレクションにメタデータ保存
6. embedTextでEmbedding生成
7. upsertVectorでPineconeにインデックス

workDataフィールド: id, artistId, createdAt, updatedAt, title, titleEn?, description, descriptionEn?, category, tags, styles, images, year, medium, dimensions?, isForSale, price?, isCommissionable, isPublic, isFeatured, searchableText

戻り値: success, workId, message

### 2. 作品アップロードフォーム

ファイル: components/dashboard/WorkUploadForm.vue

作品登録用のフォームコンポーネント。

**フォームデータ**: title, titleEn, description, category（デフォルト: "illustration"）, tags, styles, year（現在年）, medium, isPublic, isFeatured

**カテゴリ選択肢**: illustration（イラスト）, painting（絵画）, mural（壁画）, graphic_design（グラフィックデザイン）, character_design（キャラクターデザイン）, concept_art（コンセプトアート）

**機能**:
- 複数画像選択・プレビュー表示（FileReader使用）
- 画像削除
- アップロード進捗表示
- POST /api/ingest/work へFormData送信

## 音声取り込み（ポッドキャスト）

### 3. 音声アップロード & 文字起こしAPI

ファイル: server/api/ingest/audio.post.ts

FormDataでaudio（音声ファイル）とmetadata（JSON文字列）を受け取る。

処理手順:
1. 認証チェック
2. バリデーション（音声ファイル必須）
3. Firebase Storageに音声ファイルアップロード（artists/{artistId}/podcasts/にパス構成）
4. Firestoreのpodcastsコレクションにメタデータ保存（transcriptStatus="processing"）
5. 非同期でtranscribeAudio関数を実行（長時間音声はCloud Functionsへオフロード推奨）

podcastDataフィールド: id, artistId, createdAt, updatedAt, title, description, audioUrl, duration, coverImageUrl?, transcript, transcriptStatus, isPublic, publishedAt?, searchableText

戻り値: success, podcastId, message, status="processing"

**transcribeAudio(artistId, podcastId, audioFile)**: OpenAI Whisper API（whisper-1、language="ja"）で文字起こし実行。成功時はtranscript、transcriptStatus="completed"、searchableTextを更新し、Pineconeにインデックス。失敗時はtranscriptStatus="failed"に更新。

## 記事取り込み

### 4. 記事保存API

ファイル: server/api/ingest/article.post.ts

JSONボディでtitle, content, category?, tags?, coverImageUrl?, isPublic?を受け取る。

処理手順:
1. 認証チェック
2. バリデーション（title、content必須）
3. prepareSearchableTextで検索用テキスト生成
4. Firestoreのarticlesコレクションに保存
5. embedTextでEmbedding生成
6. upsertVectorでPineconeにインデックス

articleDataフィールド: id, artistId, createdAt, updatedAt, title, content, excerpt（先頭200文字）, category（デフォルト: "diary"）, tags, coverImageUrl?, isPublic, publishedAt?, searchableText

戻り値: success, articleId, message

## バッチ処理（既存データの再インデックス）

### 5. 再インデックスバッチ

ファイル: server/api/admin/reindex.post.ts

管理者権限が必要。JSONボディでartistId, types?（"work" | "article" | "podcast"の配列）を受け取る。

処理内容:
- 指定されたtypes（未指定の場合は全タイプ）のデータをFirestoreから取得
- 各ドキュメントに対してprepareSearchableText → embedText → upsertVectorを実行
- ポッドキャストはtranscriptStatus="completed"のもののみ対象

戻り値: success, indexed (works, articles, podcastsの各処理件数)

## データ削除フロー

ファイル: server/api/works/[id].delete.ts

作品削除API。パスパラメータでworkIdを受け取る。

処理手順:
1. 認証チェック
2. 作品データ取得、存在確認・所有者確認（404エラー）
3. Firebase Storageから関連画像を削除
4. deleteVectorでPineconeからベクトル削除
5. Firestoreから作品ドキュメント削除

戻り値: success, message

---

# 8. デプロイ構成

> **Note**: Monorepo構成（Nuxt + Nitro分離）については [09-monorepo-architecture.md](./09-monorepo-architecture.md) を参照してください。
> 以下は単一アプリ構成の参考情報です。

## 概要

Nuxt 4をVercelにデプロイし、Firebase（Auth/Firestore/Storage）とPineconeをバックエンドとして使用する構成。

**アーキテクチャ**:

Vercel上のNuxt 4アプリケーション:
- Pages (SSR)、Components (Vue)、Composables (Vue 3.5)
- Server Routes (Edge): /api/chat, /api/ingest/*, /api/artist/*

外部サービス連携: Firebase (Auth/DB/Storage)、Pinecone (Vector Index)、Claude 4.5 Opus

## Nuxt 4 設定

### nuxt.config.ts

ファイル: nuxt.config.ts

**基本設定**: compatibilityDate="2024-11-01", future.compatibilityVersion=4, devtools有効

**modules**: @nuxt/ui, @vueuse/nuxt

**nitro設定**: preset="vercel-edge"。/api/**にCORS設定、/api/chatはEdge Functions。

**runtimeConfig**:
- Server-only: anthropicApiKey, openaiApiKey, pineconeApiKey, pineconeIndex, firebaseProjectId, firebaseClientEmail, firebasePrivateKey
- Public: firebaseApiKey, firebaseAuthDomain, firebaseProjectId, firebaseStorageBucket

**app.head**: title="egoGraphica", description="Artist AI Agent Platform"

## Vercel 設定

### vercel.json

ファイル: vercel.json

**ビルド設定**: framework="nuxtjs", buildCommand="nuxt build", outputDirectory=".output", installCommand="pnpm install"

**functions**: api/**/*.tsのmaxDuration=60秒

**headers**: /api/(.*)に対してCORS設定（Allow-Credentials, Allow-Origin, Allow-Methods, Allow-Headers）

**crons**: /api/cron/cleanupを毎日0時に実行（schedule="0 0 * * *"）

### 環境変数設定

Vercel CLIで以下の環境変数をproduction環境に設定:

- ANTHROPIC_API_KEY, OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX
- FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
- NUXT_PUBLIC_FIREBASE_API_KEY, NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NUXT_PUBLIC_FIREBASE_PROJECT_ID, NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET

## Firebase 設定

### Firebase初期化（クライアント側）

ファイル: plugins/firebase.client.ts

Nuxtプラグインとしてfirebaseを初期化。runtimeConfigからpublicのfirebaseApiKey, firebaseAuthDomain, firebaseProjectId, firebaseStorageBucketを取得。

提供オブジェクト: $firebase (app, auth, db, storage)

### Firebase Admin初期化（サーバー側）

ファイル: server/utils/firebase-admin.ts

**initFirebaseAdmin()**: 初期化済みまたはgetApps().length > 0の場合はスキップ。runtimeConfigからcredential（projectId, clientEmail, privateKey）を取得し初期化。privateKeyの\\nを改行に変換。

**getDb()**: initFirebaseAdmin()後にgetFirestore()を返す。

**getAdminAuth()**: initFirebaseAdmin()後にgetAuth()を返す。

**getAdminStorage()**: initFirebaseAdmin()後にgetStorage()を返す。

### Firebase Security Rules

ファイル: firestore.rules

**artists/{artistId}**: 誰でも読み取り可、本人のみ書き込み可

**works/{workId}**: isPublic=trueまたは本人なら読み取り可、本人のみ書き込み可

**articles/{articleId}**: isPublic=trueまたは本人なら読み取り可、本人のみ書き込み可

**podcasts/{podcastId}**: isPublic=trueまたは本人なら読み取り可、本人のみ書き込み可

**conversations/{conversationId}**: 誰でも読み取り・作成可、本人のみ更新・削除可。messages/{messageId}サブコレクションは誰でも読み取り・作成可

**quotes/{quoteId}**: 本人またはcustomer.emailの一致で読み取り可、本人のみ書き込み可

## Pinecone 設定

### インデックス作成

Pinecone ConsoleまたはAPI経由で作成。

Index設定: Name="ego-graphica", Dimensions=1536（text-embedding-3-small）, Metric=cosine, Pod Type=Serverless, Region=us-east-1（Vercelに近い）

### Pinecone初期化

ファイル: server/utils/pinecone.ts

**getPinecone()**: シングルトンでPineconeクライアントを取得。runtimeConfigからpineconeApiKeyを使用。

**getIndex()**: getPinecone()後にruntimeConfigのpineconeIndexを指定してインデックスを返す。

## デプロイフロー

### GitHub Actions

ファイル: .github/workflows/deploy.yml

**トリガー**: mainブランチへのpush、mainブランチへのPR

**環境変数**: VERCEL_ORG_ID, VERCEL_PROJECT_ID（secrets経由）

**ステップ**:
1. checkout
2. pnpm v9セットアップ
3. Node.js 20セットアップ（pnpmキャッシュ有効）
4. pnpm install
5. pnpm nuxi typecheck（型チェック）
6. pnpm lint
7. Vercel CLIインストール
8. vercel pull --yes --environment=production
9. vercel build --prod
10. vercel deploy --prebuilt --prod

## 開発環境セットアップ

### ローカル開発

1. git clone後、cd ego-graphica
2. pnpm install
3. cp .env.example .env.local、.env.localを編集
4. firebase emulators:start（オプション）
5. pnpm dev

### .env.example

必要な環境変数:

- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- PINECONE_API_KEY, PINECONE_INDEX（dev環境ではego-graphica-dev）
- FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
- NUXT_PUBLIC_FIREBASE_API_KEY, NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NUXT_PUBLIC_FIREBASE_PROJECT_ID, NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET

## 監視・運用

### Vercel Analytics

nuxt.config.tsのmodulesに@vercel/analytics/nuxtを追加。

### エラー監視（Sentry）

ファイル: plugins/sentry.client.ts

runtimeConfig.public.sentryDsnが存在する場合、@sentry/vueを初期化。environment=process.env.NODE_ENV, tracesSampleRate=0.1。

### ヘルスチェック

ファイル: server/api/health.get.ts

GET /api/health でシステム状態を確認。

チェック項目:
- firebase: getDb()で_health/pingドキュメントを取得
- pinecone: getIndex().describeIndexStats()
- anthropic: runtimeConfigにanthropicApiKeyが存在するか

戻り値: status（"healthy" | "degraded"）, checks（各項目のtrue/false）, timestamp

## 本番チェックリスト

- [ ] 環境変数がすべて設定されている
- [ ] Firebase Security Rulesがデプロイされている
- [ ] Pineconeインデックスが作成されている
- [ ] ドメインが設定されている
- [ ] SSL証明書が有効
- [ ] CORS設定が正しい
- [ ] エラー監視が有効
- [ ] バックアップ戦略が設定されている

---

# 9. マルチモーダルRAG（Claude Vision）

## 概要

Claude 4.5 OpusのVision機能を活用し、画像を理解・検索可能にするマルチモーダルRAG。画像からリッチなテキスト記述を生成し、テキストEmbeddingとして検索可能にする。

処理フロー: Image → Claude Vision → Rich Description → Text Embedding → Pinecone → Semantic Search → Relevant Works

## アーキテクチャ

**Multimodal RAG Pipeline**

【インジェスト時】: 作品画像 → Claude Vision詳細分析 → Rich Description（JSON構造化） → Text Embedding + Pinecone

【検索時】: 「青い海の絵ある？」→ Semantic Search → 類似作品を視覚的特徴で検索

【チャット時】: 顧客が画像添付「こんな感じで」→ Claude Visionで分析 → 類似作品検索 → 提案

## 画像分析パイプライン

### 1. Vision分析ユーティリティ

ファイル: server/utils/vision.ts

Anthropic SDKを使用。

**ImageAnalysis型**:

視覚的特徴（visual）:
- dominantColors: string[]（主要な色、例: ['深い青', '白', '金']）
- colorMood: string（色の印象、例: '落ち着いた', '鮮やか'）
- composition: string（構図、例: '中央配置', '三分割'）
- style: string（スタイル、例: '写実的', '抽象的', 'ミニマル'）
- technique: string（技法、例: '油彩風', '水彩風', 'デジタル'）

コンテンツ（content）:
- subject: string（主題、例: '海辺の風景'）
- elements: string[]（要素、例: ['波', '夕日', '岩']）
- mood: string（雰囲気、例: '静謐', '躍動的'）
- narrative: string（物語性、例: 'どこか懐かしい夏の記憶を...'）

メタ情報（meta）:
- suggestedTags: string[]（推奨タグ）
- similarStyles: string[]（類似スタイル）
- targetAudience: string（ターゲット層）
- useCase: string[]（用途、例: ['ポスター', '書籍カバー']）

検索用テキスト:
- searchableDescription: string（全体を統合した自然言語説明）

**analyzeImage(imageUrl, existingMetadata?)**: 画像URLとオプションのメタデータ（title, artistStyle, category）を受け取り、Claude 4.5 Opus（claude-opus-4-5-20250514）でVision分析を実行。JSON形式でImageAnalysisを返す。max_tokens=2000。

**analyzeImageBase64(base64Data, mediaType, existingMetadata?)**: Base64エンコードされた画像データ（image/jpeg, image/png, image/gif, image/webp）を分析。処理内容はanalyzeImageと同様。

### 2. 画像分析の統合（作品アップロード時）

ファイル: server/api/ingest/work.post.ts の更新版

処理手順:
1. 認証チェック（requireAuth）
2. FormDataから画像とメタデータを取得
3. 画像をFirebase Storageにアップロード
4. アーティストのペルソナからスタイル情報を取得
5. Claude Visionで画像分析（analyzeImage）
6. buildMultimodalSearchTextで検索用テキスト構築（テキスト + 画像分析結果）
7. Firestoreに保存（imageAnalysisフィールドに分析結果を含む）
8. Embedding生成 & Pineconeにインデックス（AIが提案したタグ、視覚的特徴をメタデータに追加）

**buildMultimodalSearchText(params)**: title, description, tags, imageAnalysisを結合。タイトル、説明、タグ、視覚的特徴、色彩、主題、要素、雰囲気、物語性、推奨用途、searchableDescriptionを改行区切りで結合。

Pineconeメタデータへの追加フィールド: colors（dominantColors）, style, mood, suggestedTags

戻り値: success, workId, imageAnalysis

## 顧客からの画像アップロード対応

### 3. チャットでの画像添付

ファイル: server/api/chat.post.ts の更新版

処理手順:
1. messagesとartistIdを取得
2. 最新のユーザーメッセージを取得
3. 画像添付チェック（hasImageAttachment）
4. 画像がある場合: extractImageUrlで画像URL取得 → analyzeImageで分析 → 分析結果をコンテキストに追加 → 検索クエリを画像特徴で拡張
5. RAG検索とペルソナ取得を並列実行
6. システムプロンプト構築（RAGコンテキスト + 画像分析コンテキスト）
7. Claude 4.5 Opusでストリーミング応答生成

**hasImageAttachment(message)**: メッセージ内容がArrayで、type='image'の要素があるかチェック。

**extractImageUrl(message)**: 画像コンテンツからURLを抽出（source.url または image_url.url）。

**convertMessagesForClaude(messages)**: メッセージ配列をClaude Vision形式に変換。画像はtype='image', source.type='url'形式に変換。

画像分析コンテキストに含む情報: スタイル、色彩、雰囲気、主題、詳細説明。「この特徴に近い作品を提案してください」という指示を追加。

### 4. フロントエンド: 画像添付UI

ファイル: components/chat/ChatInput.vue

@ai-sdk/vueのuseChatを使用。

**状態管理**: attachedImage（file, preview, base64を保持）

**handleImageSelect(event)**: ファイル選択時にプレビュー生成（URL.createObjectURL）とBase64変換（FileReader）を実行。

**removeImage()**: プレビューURLを解放し、attachedImageをクリア。

**handleSubmitWithImage(e)**: 画像がある場合はFormDataで送信。送信後にremoveImage()で画像をクリア。

**fileToBase64(file)**: FileReaderでBase64変換。data:image/...;base64,プレフィックスを除去。

**UI構成**:
- 添付画像プレビュー: 80x80のサムネイル、削除ボタン付き
- 画像添付ボタン: ファイル選択input（accept="image/*"）、アイコン表示
- テキスト入力: placeholder="メッセージを入力... または画像を添付"
- 送信ボタン: テキストまたは画像がある場合に有効化
- 案内テキスト: 「画像を添付して「こんな感じで」と伝えると、類似作品を提案します」

## 視覚的類似検索

### 5. 色・スタイルでのフィルタリング

ファイル: server/utils/visual-search.ts

**VisualSearchOptions型**: query?, colors?（色で絞り込み）, style?（スタイルで絞り込み）, mood?（雰囲気で絞り込み）, topK?

**visualSearch(artistId, options)**: 視覚的特徴による検索。

処理手順:
1. 検索クエリ構築: query、色、スタイル、雰囲気を結合
2. クエリをEmbedding化
3. Pineconeメタデータフィルター構築: type='work'、colors（$in演算子で部分一致）、style
4. searchSimilarで検索実行

### 6. 視覚検索ツール

ファイル: server/utils/tools/visual-search.ts

**visualSearchTool(artistId)**: Vercel AI SDKのtool関数を使用。

説明: 視覚的な特徴で作品を検索。色、スタイル、雰囲気などで絞り込み可能。「青っぽい作品」「暖かい雰囲気の絵」「ミニマルなデザイン」などの検索に使用。

パラメータ:
- query?: string（検索キーワード）
- colors?: string[]（検索したい色、例: ["青", "白"]）
- style?: enum（'写実的', '抽象的', 'ミニマル', 'ポップ', '和風', '水彩風', '油彩風', 'デジタル'）
- mood?: enum（'静謐', '躍動的', '幻想的', '懐かしい', 'クール', '温かい', 'ダーク', 'ポジティブ'）

戻り値: success, works（id, title, colors, style, mood, score）, displayComponent="VisualSearchResults"

## 活用例

### 顧客との会話例

顧客: こんにちは、イラストの依頼を考えています

AI: ケロケロ！お問い合わせありがとうございます。どのようなイラストをお探しですか？イメージがあれば画像を添付いただくと、類似作品をお探しできますよ。

顧客: （画像を添付）こんな感じの雰囲気で、海をテーマにしたものを

AI: 素敵な参考画像ですね！青を基調とした静謐な雰囲気、水彩風のタッチですね。（showPortfolio実行: style="水彩風", mood="静謐"）こちらの作品たちが近いイメージかと思います。特に「波紋の記憶」は海をテーマにしており、お客様のイメージに近いのではないでしょうか？

顧客: いいですね！こういう青の色味が好きです

AI: （visualSearch実行: colors=["深い青", "水色"]）青系の作品をもう少しお見せしますね。「深海の静寂」「夏の終わり」なども同じような色調で制作しています。

## コスト考慮

| 処理 | API | コスト目安 |
|------|-----|-----------|
| 画像分析（アップロード時） | Claude 4.5 Opus Vision | ~$0.02/画像 |
| 顧客画像分析（チャット時） | Claude 4.5 Opus Vision | ~$0.02/画像 |
| テキストEmbedding | OpenAI text-embedding-3-small | ~$0.00002/1K tokens |

### コスト最適化

ファイル: （キャッシュ実装）

**getOrAnalyzeImage(imageUrl)**: 画像分析のキャッシュ処理。同じ画像の再分析を防ぐ。

処理手順:
1. 画像URLからMD5ハッシュを生成
2. Firestoreの_cacheコレクションでキャッシュ確認
3. キャッシュがあれば返却
4. なければ新規分析（analyzeImage）
5. キャッシュ保存（7日間有効、expiresAtフィールドで管理）

---

# 10. Monorepo アーキテクチャ

## 概要

npm workspacesを使用したmonorepo構成。フロントエンド（Nuxt 4）とバックエンド（Nitro）を分離し、共有パッケージで型定義・ユーティリティを共通化。

**構成**:
- apps/web: Nuxt 4（UI専用、SSR）→ Vercel
- apps/api: Nitro Server（I/O、AI処理）→ Vercel Functions / Cloudflare Workers
- packages/shared: 共有型定義、バリデーション
- packages/ui: 共有UIコンポーネント（オプション）
- packages/config: 共有設定（ESLint、TypeScript）

## ディレクトリ構成

**ルート**:
- package.json: workspaces定義
- turbo.json: Turborepo設定
- .env.example

**apps/web/**（Nuxt 4 Frontend）:
- nuxt.config.ts, package.json, app.vue
- pages/: index.vue, artist/[id]/index.vue, artist/[id]/chat.vue, dashboard/index.vue, dashboard/works.vue, dashboard/persona.vue
- components/chat/: ChatContainer.vue, ChatInput.vue, MessageBubble.vue, ToolResultRenderer.vue
- components/portfolio/: WorkCard.vue
- composables/: useApi.ts（APIクライアント）, useArtistChat.ts, useAuth.ts（API経由の認証）

**apps/api/**（Nitro Server）:
- nitro.config.ts, package.json
- routes/: chat.post.ts（POST /chat）, health.get.ts（GET /health）
- routes/artist/: [id].get.ts, persona.put.ts
- routes/ingest/: work.post.ts, article.post.ts, audio.post.ts
- utils/ai/: claude.ts, embedding.ts, vision.ts
- utils/db/: firebase.ts, pinecone.ts
- utils/rag/: search.ts, context.ts
- utils/tools/: index.ts, portfolio.ts, quote.ts, availability.ts
- middleware/: auth.ts

**packages/shared/**（共有パッケージ）:
- package.json, tsconfig.json
- src/index.ts
- src/types/: artist.ts, work.ts, chat.ts, api.ts
- src/schemas/: artist.ts, work.ts, chat.ts（Zodスキーマ）
- src/utils/: format.ts

**packages/config/**（共有設定）:
- eslint/index.js
- typescript/base.json

**llm/**（ドキュメント）:
- 00-overview.md, ...

## ワークスペース設定

### ルート package.json

ファイル: package.json

name="ego-graphica", private=true

workspaces: "apps/*", "packages/*"

scripts:
- dev: turbo dev
- dev:web: turbo dev --filter=@egographica/web
- dev:api: turbo dev --filter=@egographica/api
- build: turbo build
- lint: turbo lint
- typecheck: turbo typecheck
- clean: turbo clean && rm -rf node_modules

devDependencies: turbo ^2.3.0, typescript ^5.6.0

### turbo.json

ファイル: turbo.json

$schema: https://turbo.build/schema.json

globalDependencies: [".env"]

tasks:
- dev: cache=false, persistent=true
- build: dependsOn=["^build"], outputs=[".output/**", ".nuxt/**", "dist/**"]
- lint: dependsOn=["^lint"]
- typecheck: dependsOn=["^typecheck"]
- clean: cache=false

## apps/web (Nuxt 4 Frontend)

### package.json

ファイル: apps/web/package.json

name="@egographica/web", private=true, type="module"

scripts: dev（nuxt dev）, build（nuxt build）, preview（nuxt preview）, lint（eslint .）, typecheck（nuxt typecheck）

dependencies: nuxt ^4.0.0, vue ^3.5.0, @ai-sdk/vue ^1.0.0, @egographica/shared

devDependencies: @nuxt/devtools, @egographica/config

### nuxt.config.ts

ファイル: apps/web/nuxt.config.ts

基本設定: compatibilityDate="2024-11-01", future.compatibilityVersion=4

modules: @nuxt/ui, @vueuse/nuxt

nitro.devProxy: /api → 環境変数API_URL または http://localhost:3001（changeOrigin=true）

runtimeConfig.public.apiUrl: 環境変数NUXT_PUBLIC_API_URL または http://localhost:3001

### APIクライアント

ファイル: apps/web/composables/useApi.ts

@egographica/sharedからChatRequest, ChatResponse, WorkUploadResponse型をインポート。

**useApi()**: APIクライアントを返す。

**fetchApi<T>(path, options)**: 共通のAPI呼び出し関数。useAuth()でトークン取得、Authorizationヘッダー付与、Content-Type: application/json。エラー時はthrow。

返却メソッド:
- chat(artistId, messages): POST /chat、ストリーミング用にfetchを直接返却
- uploadWork(formData): POST /ingest/work、FormData送信、Authorizationヘッダー付与
- getArtist(id): GET /artist/{id}
- updatePersona(data): PUT /artist/persona

### チャットUI

ファイル: apps/web/pages/artist/[id]/chat.vue

@ai-sdk/vueのuseChatを使用。

props: artistId（route.params.id）

useChatオプション: api=runtimeConfig.public.apiUrl + "/chat", body={ artistId }

取得値: messages, input, handleSubmit, isLoading

テンプレート構成:
- ChatHeader（artistId表示）
- メッセージ一覧（MessageBubbleコンポーネント、v-for）
- ChatInput（v-model=input, isLoading, @submit=handleSubmit）

## apps/api (Nitro Server)

### package.json

ファイル: apps/api/package.json

name="@egographica/api", private=true, type="module"

scripts: dev（nitro dev）, build（nitro build）, preview（nitro preview）, lint（eslint .）, typecheck（tsc --noEmit）

dependencies:
- nitropack ^2.10.0, h3 ^1.13.0
- ai ^4.0.0, @ai-sdk/anthropic ^1.0.0, @ai-sdk/openai ^1.0.0
- @pinecone-database/pinecone ^3.0.0, firebase-admin ^12.0.0
- zod ^3.23.0, @egographica/shared

devDependencies: @egographica/config

### nitro.config.ts

ファイル: apps/api/nitro.config.ts

preset: "vercel"（または "cloudflare-module"）

routeRules./chat: ストリーミング対応ヘッダー（Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive）

runtimeConfig: anthropicApiKey, openaiApiKey, pineconeApiKey, pineconeIndex, firebaseProjectId, firebaseClientEmail, firebasePrivateKey（すべて環境変数から取得）

handlers: /**に対してcorsミドルウェア適用

### チャットAPI

ファイル: apps/api/routes/chat.post.ts

インポート: h3（defineEventHandler, readBody, setResponseHeader）, ai（streamText）, @ai-sdk/anthropic, @egographica/shared（ChatRequestSchema）, RAG関連, vision, chatTools

処理手順:
1. リクエストボディをChatRequestSchemaでバリデーション
2. 最新のユーザーメッセージを取得
3. 画像添付チェック → あればanalyzeImageで分析、コンテキストとクエリを拡張
4. RAG検索とペルソナ取得を並列実行
5. システムプロンプト構築（RAGコンテキスト + 画像コンテキスト）
6. ストリーミング用レスポンスヘッダー設定
7. streamTextでClaude 4.5 Opus応答生成（tools=chatTools, maxTokens=4096, temperature=0.7）
8. toDataStreamResponse()を返却

### 作品アップロードAPI

ファイル: apps/api/routes/ingest/work.post.ts

インポート: h3（defineEventHandler, readFormData）, @egographica/shared（WorkUploadSchema）, vision, embedding, pinecone, firebase

処理手順:
1. 認証チェック（requireAuth）
2. FormDataから画像とメタデータ取得、WorkUploadSchemaでバリデーション
3. 画像をStorageにアップロード
4. Claude Visionで画像分析
5. 検索用テキスト構築
6. Firestoreに保存（id, artistId, metadata, images, imageAnalysis, searchableText, createdAt, updatedAt）
7. Embedding生成 & Pineconeにインデックス（メタデータにtags, colors, style, mood含む）

戻り値: success, workId, imageAnalysis

### CORSミドルウェア

ファイル: apps/api/middleware/cors.ts

h3からdefineEventHandler, setResponseHeaders, getMethodをインポート。

許可オリジン: http://localhost:3000, https://ego-graphica.vercel.app, 環境変数WEB_URL

処理:
1. リクエストのoriginが許可リストに含まれる場合、CORSヘッダーを設定（Allow-Origin, Allow-Methods, Allow-Headers, Allow-Credentials）
2. OPTIONSメソッド（Preflight）の場合、204を返して終了

## packages/shared

### package.json

ファイル: packages/shared/package.json

name="@egographica/shared", version="0.0.0", private=true, type="module"

main: ./dist/index.js, types: ./dist/index.d.ts

exports: "."にtypes, importを設定

scripts: build（tsup --format esm --dts）, dev（tsup --watch）, typecheck（tsc --noEmit）

dependencies: zod ^3.23.0

devDependencies: tsup ^8.0.0, typescript ^5.6.0

### 型定義

ファイル: packages/shared/src/types/artist.ts

**Artist型**: id, createdAt (Timestamp), updatedAt (Timestamp), profile (ArtistProfile), persona (ArtistPersona), settings (AgentSettings)

**ArtistProfile型**: name, nameKana?, email, bio, website?, socialLinks (twitter?, instagram?, behance?), profileImageUrl?, specialties[], styles[]

**ArtistPersona型**: characterName?, motif, tone ('formal' | 'friendly' | 'artistic' | 'professional' | 'playful'), personality[], artisticPhilosophy, influences[], keywords[], greetingStyle, sampleResponses (SampleResponse[]), avoidTopics[], backstory

**SampleResponse型**: situation, customerMessage, idealResponse

**AgentSettings型**: isActive, autoReply, priceTable (PriceTable), currency ('JPY' | 'USD'), leadTime

**PriceTable型**: illustration (small, medium, large), mural (perSquareMeter, minimumCharge), collaboration (hourlyRate, minimumHours)

### Zodスキーマ

ファイル: packages/shared/src/schemas/chat.ts

**MessageSchema**: role（'user' | 'assistant' | 'system'）, content（stringまたはtext/image配列）

**ChatRequestSchema**: artistId（string、1文字以上）, messages（MessageSchema配列）

**ChatRequest型**: ChatRequestSchemaのinfer

ファイル: packages/shared/src/schemas/work.ts

**WorkUploadSchema**: title（1-100文字）, titleEn?, description?, category（enum、デフォルト'illustration'）, tags?[], styles?[], year?（1900-2100）, isPublic（デフォルトtrue）, isFeatured（デフォルトfalse）

**WorkUpload型**: WorkUploadSchemaのinfer

### エントリポイント

ファイル: packages/shared/src/index.ts

Types export: Artist, ArtistProfile, ArtistPersona, AgentSettings, PriceTable, Work, WorkCategory, WorkImage, ImageAnalysis, ChatRequest, Message, Conversation

Schemas export: ChatRequestSchema, MessageSchema, WorkUploadSchema, ArtistPersonaSchema

Utils export: formatPrice, formatDate

## デプロイ構成

### Vercel（マルチアプリ）

ファイル: apps/web/vercel.json

framework="nuxtjs", buildCommand="npm run build", outputDirectory=".output"

ファイル: apps/api/vercel.json

buildCommand="npm run build", outputDirectory=".output", functions/**/*.tsにmaxDuration=60

### 環境変数

**Vercel: @egographica/web**:
- NUXT_PUBLIC_API_URL: https://api.egographica.com

**Vercel: @egographica/api**:
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- PINECONE_API_KEY
- PINECONE_INDEX: egographica
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- WEB_URL: https://egographica.com

## 開発ワークフロー

**セットアップ**: npm install

**全体開発**: npm run dev

**個別開発**:
- npm run dev:web → http://localhost:3000
- npm run dev:api → http://localhost:3001

**ビルド**: npm run build

**型チェック**: npm run typecheck

**Lint**: npm run lint

## アーキテクチャ図（更新版）

apps/web（Nuxt 4）⟷ HTTP ⟷ apps/api（Nitro）

apps/web:
- UI Components
- Pages
- @ai-sdk/vue

apps/api:
- /chat, /ingest/*, /artist/*
- firebase-admin
- Vision Analysis

両者が参照: packages/shared（Types, Zod Schemas, Utils）

apps/apiが接続する外部サービス:
- Firebase（Admin）: Auth, Store, Storage
- Pinecone: Vector, Search
- Claude 4.5 Opus: Chat, Vision

※ Firebase操作はすべてAPIサーバー（firebase-admin）経由。クライアントにFirebase SDKは使用しない。

---

# 11. Pinecone セットアップガイド

## 概要

Pineconeはベクトルデータベースサービス。アーティストの作品・記事・ポッドキャストをEmbedding化して保存し、セマンティック検索（RAG）を実現する。

処理フロー: 作品データ → OpenAI Embedding (text-embedding-3-large) → Pinecone (GCP) → 類似検索

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

Pinecone CLIを使用する場合:

1. npm install -g pinecone-cli でインストール
2. pinecone login でログイン
3. pinecone create-index egographica --dimension 3072 --metric cosine --cloud gcp --region us-central1 でIndex作成

## 3. API Key 取得

### 3.1 Console から取得

1. Pinecone Console の左サイドバー → 「API Keys」
2. 「Create API Key」をクリック
3. 名前を入力（例: `egographica-production`）
4. 生成されたキーをコピー

### 3.2 環境変数に設定

必要な環境変数:
- PINECONE_API_KEY: pcsk_xxxxxx...
- PINECONE_INDEX: egographica

## 4. 実装

### 4.1 Pinecone クライアント初期化

ファイル: apps/api/utils/db/pinecone.ts

@pinecone-database/pineconeからPineconeをインポート。

**getPinecone()**: シングルトンでPineconeクライアントを取得。useRuntimeConfig()からpineconeApiKeyを取得。未設定の場合はエラーをスロー。

**getIndex()**: getPinecone().index(pineconeIndex)でインデックスを返す。デフォルトは'egographica'。

### 4.2 ベクトル操作ユーティリティ

ファイル: apps/api/utils/db/pinecone.ts（続き）

**VectorMetadata型**:
- artistId: string
- type: 'work' | 'article' | 'podcast'
- sourceId: string
- title: string
- category?: string
- tags: string[]
- colors?: string[]（画像分析結果）
- style?: string（アートスタイル）
- mood?: string（雰囲気）
- text: string（検索用テキスト、1000文字以内）
- createdAt: string（ISO 8601）

**upsertVector(artistId, id, embedding, metadata)**: ベクトル追加・更新。index.namespace(artistId).upsert()を使用。

**deleteVector(artistId, id)**: ベクトル削除。index.namespace(artistId).deleteOne(id)を使用。

**deleteVectors(artistId, ids)**: 複数ベクトル削除。index.namespace(artistId).deleteMany(ids)を使用。

**deleteNamespace(artistId)**: Namespace削除（アーティスト全データ削除）。index.namespace(artistId).deleteAll()を使用。

### 4.3 類似検索

ファイル: apps/api/utils/db/pinecone.ts（続き）

**SearchOptions型**: topK?, filter?, includeMetadata?

**SearchResult型**: id, score, metadata?

**searchSimilar(artistId, queryEmbedding, options?)**: 類似ベクトル検索。index.namespace(artistId).query()を使用。デフォルト: topK=5, includeMetadata=true。results.matchesを整形して返却。

**searchByType(artistId, queryEmbedding, type, topK?)**: タイプ別検索。filter: { type: { $eq: type } }でフィルタリング。

**searchByVisual(artistId, queryEmbedding, options)**: 色・スタイルで絞り込み検索。options: colors?, style?, mood?, topK?。type='work'固定でフィルター構築。colors は $in 演算子、style/mood は $eq 演算子で絞り込み。

### 4.4 Index統計情報

ファイル: apps/api/utils/db/pinecone.ts（続き）

**IndexStats型**: totalVectorCount, namespaces（Record<string, { vectorCount }>）

**getIndexStats()**: index.describeIndexStats()でIndex統計を取得。totalRecordCount、namespacesを返却。

**getArtistVectorCount(artistId)**: アーティストのベクトル数を取得。stats.namespaces[artistId]?.vectorCountを返却。

## 5. Namespace 設計

### アーティストごとにNamespaceを分離

Index: egographica

- Namespace: artist_001
  - work_xxxxx（作品）, work_yyyyy
  - article_aaaaa（記事）
  - podcast_bbbbb（ポッドキャスト）
- Namespace: artist_002
  - work_zzzzz, ...
- Namespace: artist_003
  - ...

### メリット

1. **データ分離**: アーティストごとに完全分離
2. **検索効率**: Namespaceスコープで高速検索
3. **削除容易**: アーティスト退会時に一括削除可能
4. **スケーラブル**: アーティスト数に制限なし

## 6. Embedding生成

### OpenAI text-embedding-3-large

高精度な3072次元のEmbeddingモデルを使用。日本語対応も優秀。

ファイル: apps/api/utils/ai/embedding.ts

OpenAI SDKを使用。

**getOpenAI()**: シングルトンでOpenAIクライアントを取得。useRuntimeConfig()からopenaiApiKeyを取得。

**embedText(text)**: 単一テキストをEmbedding化。model='text-embedding-3-large', dimensions=3072。response.data[0].embeddingを返却。

**embedTexts(texts)**: 複数テキストをバッチEmbedding化。model='text-embedding-3-large', dimensions=3072。response.data.map(d => d.embedding)を返却。

**prepareSearchableText(params)**: 検索用テキストの前処理。params: title, description?, tags?, content?, imageDescription?。各パートを改行で結合し、Embeddingモデルの制限（8191トークン）を考慮して8000文字に制限。

## 7. 完全な使用例

### 作品をインデックスに追加

ファイル: apps/api/routes/ingest/work.post.ts

処理手順:
1. 認証チェック、FormData取得
2. 画像をStorageにアップロード
3. Claude Visionで画像分析
4. prepareSearchableTextで検索用テキスト構築（title, description, tags, imageDescription）
5. embedTextでEmbedding生成
6. upsertVectorでPineconeにインデックス

upsertVectorのメタデータ:
- artistId, type='work', sourceId, title, category
- tags（手動タグ + AI提案タグ）
- colors（dominantColors）, style, mood（画像分析結果）
- text（searchableTextの先頭1000文字）
- createdAt（ISO 8601）

戻り値: success, workId

### RAG検索

ファイル: apps/api/utils/rag/search.ts

**RAGResult型**: type, sourceId, title, score, snippet

**searchRelevantContent(artistId, query, options?)**: RAG検索のメイン関数。options: topK?（デフォルト5）, types?, minScore?（デフォルト0.7）

処理手順:
1. クエリをEmbedding化
2. types指定時はフィルター構築（{ type: { $in: types } }）
3. searchSimilarで検索実行
4. minScore以上の結果をフィルタリング
5. RAGResult形式に整形（snippet: text先頭200文字 + '...'）

## 8. フィルター構文

Pineconeのメタデータフィルターは MongoDB風の構文を使用。

### 比較演算子

- 等価: { field: { $eq: 'value' } }
- 不等価: { field: { $ne: 'value' } }
- greater than: { field: { $gt: 10 } }
- greater than or equal: { field: { $gte: 10 } }
- less than: { field: { $lt: 10 } }
- less than or equal: { field: { $lte: 10 } }

### 配列演算子

- 配列内に存在: { field: { $in: ['a', 'b', 'c'] } }
- 配列内に存在しない: { field: { $nin: ['x', 'y'] } }

### 論理演算子

- AND: { $and: [{ type: { $eq: 'work' } }, { style: { $eq: '和風' } }] }
- OR: { $or: [{ mood: { $eq: '静謐' } }, { mood: { $eq: '幻想的' } }] }

### 使用例

和風スタイルの作品のみ検索: filter = { $and: [{ type: { $eq: 'work' } }, { style: { $eq: '和風' } }] }

青または緑の色を含む作品: filter = { colors: { $in: ['青', '緑', '水色'] } }

## 9. コスト最適化

### バッチ処理

**upsertVectorsBatch(artistId, vectors)**: 複数ベクトルを一括アップロード。最大100件/リクエスト。BATCH_SIZE=100でループ処理し、index.namespace(artistId).upsert()を実行。

### メタデータサイズ削減

メタデータは40KBまで。textフィールドを1000文字に制限: text: searchableText.slice(0, 1000)

## 10. トラブルシューティング

### よくあるエラー

| エラー | 原因 | 対処 |
|--------|------|------|
| `Invalid API key` | APIキーが無効 | Console で再生成 |
| `Index not found` | Index名が間違っている | PINECONE_INDEX を確認 |
| `Dimension mismatch` | Embedding次元が違う | 3072次元で統一 |
| `Metadata too large` | 40KB超過 | textフィールドを削減 |

### デバッグ用エンドポイント

ファイル: apps/api/routes/debug/pinecone.get.ts

getIndexStats()でIndex統計を取得し、success=true/falseとともに返却。エラー時はerrorメッセージを含める。

## 11. 参考リンク

- [Pinecone Documentation](https://docs.pinecone.io/)
- [Pinecone Node.js Client](https://github.com/pinecone-io/pinecone-ts-client)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
