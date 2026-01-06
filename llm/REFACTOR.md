# ego Graphica - リファクタリング設計書

> `user/BLUEPRINT.md`を基準とし、`llm/BLUEPRINT.md`から「ペルソナ設定」「CAG」「Tool Calling」「マルチモーダルRAG」を採用

---

# 1. プロジェクト定義

## 概要

アーティストの思考パターンやバックグラウンドを加味した回答を行い、アーティスト本人がその場にいなくても作品展示時に顧客と会話するエージェントを構築する。

## 用語

| 用語 | 説明 |
|------|------|
| ego Graphica | 本プロジェクトの名称 |
| ego Graphicaエージェント | アーティストの代わりに接客を行うAIエージェント |
| アーティストバケット名 | アーティストごとの一意識別子（各種リソースの命名に使用） |

---

# 2. 技術スタック

## コア技術

| 役割 | 技術 | 備考 |
|------|------|------|
| フレームワーク | Nuxt 4 | SSR対応 |
| バックエンド | Nitro Server | Vercel/Cloudflare対応 |
| AI Chat UI | Vercel AI SDK | @ai-sdk/vue |
| UIライブラリ | shadcn-vue | レスポンシブ対応 |
| バリデーション | Zod | ランタイムチェック |

## LLM & AI

| 役割 | 技術 | モデルID |
|------|------|----------|
| メインLLM | Claude 4.5 Opus | `claude-opus-4-5` |
| PDF解析 | Claude Visual PDFs | `claude-opus-4-5` |
| 画像解析 | Claude Vision | `claude-opus-4-5` |
| 音声文字起こし | OpenAI | `gpt-4o-transcribe` |
| Embedding | OpenAI | `text-embedding-3-large` |

## データベース & ストレージ

| 役割 | 技術 | 備考 |
|------|------|------|
| Vector DB | Pinecone | Serverless (GCP)、3072次元 |
| メタデータDB | Firestore | firebase-admin経由 |
| ファイル保存 | Firebase Storage | firebase-admin経由 |
| 認証 | Firebase Auth | firebase-admin経由 |

---

# 3. データ構造

## 3.1 Firestoreコレクション

```
/{アーティストバケット名}/
├── profile          # アーティスト基本情報
├── persona          # ペルソナ設定（追加機能）
├── works/           # 作品データ
│   └── {workId}
├── from-url/        # スクレイピングデータ
│   └── {urlId}
├── session/         # エージェント会話履歴
│   └── {sessionId}
│       └── messages/
│           └── {messageId}
└── hearing/         # ヒアリング履歴
    └── {hearingId}
        └── messages/
            └── {messageId}
```

## 3.2 Firebase Storage

```
/{アーティストバケット名}/
└── raw/             # 元ファイル（フラット構造）
    ├── artwork1.png
    ├── interview.mp3
    ├── portfolio.pdf
    └── ...
```

## 3.3 Pinecone

```
Index: egographica
└── Namespace: {アーティストバケット名}
    ├── work_{workId}
    ├── url_{urlId}
    ├── file_{fileId}
    └── ...
```

---

# 4. データモデル

> 詳細は [llm/models.yaml](./models.yaml) を参照

---

# 5. ファイル処理パイプライン

## 5.1 対応形式と処理方法

| 形式 | 処理方法 | 出力 |
|------|----------|------|
| `.pdf` | Claude Visual PDFs | テキスト抽出 → Embedding |
| `.mp3`, `.m4a`, `.wav` | gpt-4o-transcribe | 文字起こし → Embedding |
| `.jpg`, `.png` | Claude Vision | 画像解析 → Embedding |
| `.mp4` | gpt-4o-transcribe（音声抽出） | 文字起こし → Embedding |

## 5.2 処理フロー

### ファイルアップロード時

1. ファイルをFirebase Storage `/{bucket}/raw/` に保存（元ファイル名維持）
2. ファイル形式に応じた解析処理を実行
3. 解析結果からEmbedding生成（text-embedding-3-large, 3072次元）
4. PineconeのNamespace `{bucket}` にベクトル保存

### PDF処理

ファイル: apps/api/utils/ai/pdf.ts

**analyzePdf(pdfUrl)**: Claude Visual PDFsでPDF内容を解析。ページごとにテキストと視覚情報を抽出。

### 音声処理

ファイル: apps/api/utils/ai/transcribe.ts

**transcribeAudio(audioUrl, fileType)**: gpt-4o-transcribeで音声を文字起こし。language="ja"。MP4の場合は音声トラックを抽出して処理。

### 画像処理（マルチモーダルRAG）

ファイル: apps/api/utils/ai/vision.ts

**analyzeImage(imageUrl)**: Claude Visionで画像を詳細分析。ImageAnalysis型で構造化された結果を返却。

---

# 6. 画面構成

## 6.1 アーティスト登録画面

パス: /register

**機能**:
- アーティスト名入力フォーム
- バケット名入力フォーム（自動生成オプション）
- 登録ボタン

**処理**:
1. バリデーション（バケット名の一意性確認）
2. Firebase Storage `/{bucket}/` フォルダ作成
3. Pinecone Namespace `{bucket}` 作成
4. Firestore `/{bucket}/profile` ドキュメント作成

## 6.2 情報提供画面（ファイルアップロード）

パス: /dashboard/upload

**機能**:
- ファイルドロップゾーン
- 対応形式: `.pdf`, `.mp3`, `.m4a`, `.wav`, `.jpg`, `.png`
- アップロード進捗表示
- 処理状況表示（解析中/完了/失敗）

**処理**:
1. ファイルをFirebase Storage `/{bucket}/raw/` に保存
2. ファイル形式に応じた解析処理を非同期実行
3. Embedding生成 → Pinecone保存

## 6.3 URL提供画面

パス: /dashboard/url

**機能**:
- URL入力フォーム
- スクレイピング実行ボタン
- 取得済みURL一覧表示

**処理**:
1. URLをスクレイピング
2. 本文を検出・抽出
3. Firestore `/{bucket}/from-url/{urlId}` に保存
4. Embedding生成 → Pinecone保存
5. 失敗時はエラーメッセージ表示

## 6.4 データベース提供画面（作品管理）

パス: /dashboard/works

**機能**:
- 作品一覧表示
- 新規作品登録フォーム:
  - 作品データ（.png, .jpg, .wav, .mp4）
  - タイトル
  - 作成年月日
  - クライアントワーク or 自主制作（ラジオボタン）
  - クライアント名（クライアントワーク選択時のみ表示）
  - 販売状況（売却済/売約済/販売中/非売品）
  - 説明（テキストエリア）
  - 制作ストーリー（テキストエリア）
- 作品編集・削除機能

**処理**:
1. ファイルをFirebase Storage `/{bucket}/raw/` に保存
2. 画像/動画の場合はClaude Visionで解析（マルチモーダルRAG）
3. Firestore `/{bucket}/works/{workId}` に保存
4. Embedding生成 → Pinecone保存

## 6.5 エージェント会話画面

パス: /agent/{bucket}

**機能**:
- ego GraphicaエージェントとのチャットUI
- 過去セッション一覧（サイドバー）
- セッション切り替え
- 新規セッション作成

**処理**:
1. RAGで関連情報を検索（作品、URL、ファイル）
2. ペルソナ設定をコンテキストに注入（CAG）
3. Tool Callingで作品表示等を実行
4. 会話履歴をFirestore `/{bucket}/session/{sessionId}/messages/` に保存

**Tool Calling（追加機能）**:
- showWorks: 作品をグリッド表示
- searchWorks: セマンティック検索で関連作品を検索
- visualSearch: 色・スタイル・雰囲気で作品を絞り込み

## 6.6 ヒアリング画面

パス: /dashboard/hearing

**機能**:
- Claude 4.5 Opusとの対話UI
- アーティストがエージェントへの違和感をフィードバック
- 過去ヒアリング一覧
- セッション切り替え

**処理**:
1. Claude 4.5 Opusで対話
2. 会話履歴をFirestore `/{bucket}/hearing/{hearingId}/messages/` に保存
3. フィードバック内容をペルソナ改善に活用（将来拡張）

---

# 7. API設計

## 7.1 認証

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/auth/register` | POST | アーティスト登録 |
| `/auth/login` | POST | ログイン |
| `/auth/verify` | GET | トークン検証 |

## 7.2 ファイル・データ

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/ingest/file` | POST | ファイルアップロード（PDF/音声/画像） |
| `/ingest/url` | POST | URLスクレイピング |
| `/ingest/work` | POST | 作品登録 |
| `/works` | GET | 作品一覧取得 |
| `/works/{id}` | PUT | 作品更新 |
| `/works/{id}` | DELETE | 作品削除 |

## 7.3 チャット

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/chat` | POST | エージェント会話（ストリーミング） |
| `/sessions` | GET | セッション一覧 |
| `/sessions/{id}` | GET | セッション詳細・メッセージ取得 |

## 7.4 ヒアリング

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/hearing` | POST | ヒアリング会話 |
| `/hearings` | GET | ヒアリング一覧 |
| `/hearings/{id}` | GET | ヒアリング詳細・メッセージ取得 |

## 7.5 ペルソナ

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/persona` | GET | ペルソナ取得 |
| `/persona` | PUT | ペルソナ更新 |

---

# 8. 追加機能詳細

## 8.1 ペルソナ設定

アーティスト固有の話し方・思考パターンを定義するデータ。

**設定項目**:
- キャラクター名（エージェントの名前）
- モチーフ（カエル、猫など）
- トーン（丁寧/フレンドリー/芸術的/プロフェッショナル/遊び心）
- 創作哲学
- 影響を受けた作家・文化
- 理想的な応答例
- 避けるべきトピック

## 8.2 CAG（Context Augmented Generation）

ペルソナ設定をシステムプロンプトに注入し、一貫したキャラクター性を持つ応答を生成する実装手法。

**処理フロー**:
1. Firestore `/{bucket}/persona` からペルソナ設定を取得
2. RAGで取得した関連コンテンツと統合
3. システムプロンプトを動的に構築
4. Claude 4.5 Opusに注入して応答生成

**システムプロンプト構成**:
1. 役割定義（ego Graphicaエージェント、キャラクター名）
2. キャラクター設定（モチーフ、創作哲学、影響元、バックストーリー）
3. コミュニケーションスタイル（トーン、挨拶スタイル、キーワード）
4. 応答例（理想的な応答パターン）
5. 禁止事項（避けるべきトピック）
6. RAGコンテキスト（関連作品・記事情報）
7. 応答指針（世界観体現、専門知識活用、親しみやすさ）

**実装ファイル**:
- apps/api/utils/cag/persona.ts: ペルソナ取得
- apps/api/utils/cag/prompt_builder.ts: システムプロンプト構築

## 8.3 Tool Calling

エージェントが会話中に実行できるツール。

**showWorks**: 作品をグリッド表示
- パラメータ: work_type?, sales_status?, limit?
- 表示: ChatWorksGrid コンポーネント

**searchWorks**: セマンティック検索
- パラメータ: query, limit?
- 処理: RAGで関連作品を検索

**visualSearch**: 視覚的特徴で検索（マルチモーダルRAG）
- パラメータ: colors?, style?, mood?
- 処理: 画像解析結果のメタデータでフィルタリング

## 8.4 マルチモーダルRAG

画像をClaude Visionで解析し、視覚的特徴をテキスト化してEmbedding。

**処理フロー**:
1. 作品画像アップロード
2. Claude Visionで詳細分析（色、構図、スタイル、雰囲気等）
3. 分析結果をImageAnalysis型で構造化
4. searchable_descriptionをEmbedding化
5. メタデータ（colors, style, mood）をPineconeに保存

**検索時**:
- 「青い絵ある？」→ colorsでフィルタリング + セマンティック検索
- 画像添付「こんな感じで」→ 画像解析 → 類似作品検索

---

# 9. 環境変数

| 変数名 | 用途 |
|--------|------|
| ANTHROPIC_API_KEY | Claude API認証 |
| OPENAI_API_KEY | Embedding & gpt-4o-transcribe認証 |
| PINECONE_API_KEY | Pinecone API認証 |
| PINECONE_INDEX | Pineconeインデックス名（egographica） |
| FIREBASE_PROJECT_ID | FirebaseプロジェクトID |
| FIREBASE_CLIENT_EMAIL | Firebase Adminサービスアカウント |
| FIREBASE_PRIVATE_KEY | Firebase Admin秘密鍵 |
| NUXT_PUBLIC_API_URL | APIサーバーURL |
| WEB_URL | WebアプリURL |

---

# 10. ディレクトリ構成

```
egoGraphica/
├── apps/
│   ├── web/                          # Nuxt 4 Frontend
│   │   ├── pages/
│   │   │   ├── register.vue          # アーティスト登録
│   │   │   ├── dashboard/
│   │   │   │   ├── index.vue         # ダッシュボード
│   │   │   │   ├── upload.vue        # 情報提供（ファイル）
│   │   │   │   ├── url.vue           # URL提供
│   │   │   │   ├── works.vue         # 作品管理
│   │   │   │   ├── persona.vue       # ペルソナ設定
│   │   │   │   └── hearing.vue       # ヒアリング
│   │   │   └── agent/
│   │   │       └── [bucket].vue      # エージェント会話
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   ├── works/
│   │   │   └── upload/
│   │   └── composables/
│   │       ├── useApi.ts
│   │       └── useAuth.ts
│   │
│   └── api/                          # Nitro Server
│       ├── routes/
│       │   ├── auth/
│       │   ├── ingest/
│       │   │   ├── file.post.ts
│       │   │   ├── url.post.ts
│       │   │   └── work.post.ts
│       │   ├── chat.post.ts
│       │   ├── hearing.post.ts
│       │   ├── persona.get.ts
│       │   ├── persona.put.ts
│       │   ├── sessions.get.ts
│       │   ├── works.get.ts
│       │   └── ...
│       ├── utils/
│       │   ├── ai/
│       │   │   ├── claude.ts
│       │   │   ├── pdf.ts
│       │   │   ├── transcribe.ts
│       │   │   ├── vision.ts
│       │   │   └── embedding.ts
│       │   ├── db/
│       │   │   ├── firebase.ts
│       │   │   └── pinecone.ts
│       │   ├── cag/
│       │   │   ├── persona.ts
│       │   │   └── prompt_builder.ts
│       │   ├── rag/
│       │   │   └── search.ts
│       │   ├── scraper/
│       │   │   └── index.ts
│       │   └── tools/
│       │       ├── index.ts
│       │       ├── show_works.ts
│       │       ├── search_works.ts
│       │       └── visual_search.ts
│       └── middleware/
│           ├── auth.ts
│           └── cors.ts
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── profile.ts
│       │   │   ├── persona.ts
│       │   │   ├── work.ts
│       │   │   ├── from_url.ts
│       │   │   ├── session.ts
│       │   │   └── hearing.ts
│       │   ├── schemas/
│       │   ├── messages/
│       │   │   ├── error.ts
│       │   │   └── log.ts
│       │   └── index.ts
│       └── package.json
│
├── user/
│   └── BLUEPRINT.md
│
├── llm/
│   ├── BLUEPRINT.md
│   ├── DIFF.md
│   └── REFACTOR.md
│
├── package.json
├── turbo.json
├── .env.example
└── CLAUDE.md
```

---

# 11. 実装優先度

## Phase 1: 基盤構築

1. アーティスト登録画面・API
2. Firestore/Storage/Pinecone初期化処理
3. 認証フロー

## Phase 2: データ取り込み

4. 情報提供画面（ファイルアップロード）
5. PDF解析（Claude Visual PDFs）
6. 音声文字起こし（gpt-4o-transcribe）
7. 画像解析（Claude Vision）
8. URL提供画面（スクレイピング）

## Phase 3: 作品管理

9. データベース提供画面（作品CRUD）
10. 作品データモデル実装

## Phase 4: エージェント

11. エージェント会話画面
12. RAG検索実装
13. ペルソナ設定画面・API
14. Tool Calling実装
15. マルチモーダルRAG

## Phase 5: フィードバック

16. ヒアリング画面
