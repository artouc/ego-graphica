# 技術スタック

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

---

## Monorepo構成

```
egoGraphica/
├── package.json              # npm workspaces
├── turbo.json
│
├── apps/
│   ├── web/                  # Nuxt 4 (UIのみ)
│   │   └── dependencies:
│   │       - nuxt
│   │       - @ai-sdk/vue
│   │       - @egographica/shared
│   │
│   └── api/                  # Nitro (I/O、認証、AI処理)
│       └── dependencies:
│           - nitropack
│           - firebase-admin    ← サーバーサイドのみ
│           - @ai-sdk/anthropic
│           - @pinecone-database/pinecone
│           - @egographica/shared
│
└── packages/
    └── shared/               # 型定義、Zodスキーマ
```

---

## 環境変数

```env
# Anthropic (Claude 4.5 Opus)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# OpenAI (Embedding & Whisper)
OPENAI_API_KEY=sk-xxxxx

# Pinecone
PINECONE_API_KEY=xxxxx
PINECONE_INDEX=egographica

# Firebase Admin (サーバーサイドのみ)
FIREBASE_PROJECT_ID=egographica
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@egographica.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# URLs
NUXT_PUBLIC_API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
```

---

## 認証フロー (firebase-admin)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │         │  API Server │         │  Firebase   │
│  (Nuxt)     │         │  (Nitro)    │         │   Admin     │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. Login Request     │                       │
       │  (email/password)     │                       │
       │──────────────────────▶│                       │
       │                       │  2. Verify/Create     │
       │                       │──────────────────────▶│
       │                       │                       │
       │                       │  3. Custom Token      │
       │                       │◀──────────────────────│
       │  4. Return Token      │                       │
       │◀──────────────────────│                       │
       │                       │                       │
       │  5. API Request       │                       │
       │  (Bearer Token)       │                       │
       │──────────────────────▶│                       │
       │                       │  6. Verify Token      │
       │                       │──────────────────────▶│
       │                       │                       │
       │                       │  7. User Info         │
       │                       │◀──────────────────────│
       │  8. Response          │                       │
       │◀──────────────────────│                       │
```

### 認証APIエンドポイント

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/auth/login` | POST | メール/パスワードでログイン |
| `/auth/register` | POST | 新規ユーザー登録 |
| `/auth/verify` | GET | トークン検証 |
| `/auth/refresh` | POST | トークン更新 |

---

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
