# 技術スタック

## コア技術

### フロントエンド & フレームワーク

| 役割 | 技術 | バージョン | 理由 |
|------|------|-----------|------|
| フレームワーク | **Nuxt 4** | 4.x | SSR/SSG、Server Routes統合、Vue 3.5+対応 |
| AI Chat UI | **Vercel AI SDK** | 4.x | `@ai-sdk/vue`でuseChat/useCompletion対応 |
| UI Library | **Nuxt UI** or **Radix Vue** | - | アクセシブルなコンポーネント |
| スタイリング | **Tailwind CSS** | 4.x | ユーティリティファースト |

### LLM & AI

| 役割 | 技術 | モデルID | 理由 |
|------|------|----------|------|
| メインLLM | **Claude 4.5 Opus** | `claude-opus-4-5-20250514` | 最高品質のペルソナ維持、長文コンテキスト200K |
| Embedding | **OpenAI** | `text-embedding-3-small` | 1536次元、コスパ良好 |
| 代替Embedding | **Voyage AI** | `voyage-3` | クリエイティブコンテンツ向け最適化 |
| 音声文字起こし | **OpenAI Whisper** | `whisper-1` | 日本語対応、高精度 |

### データベース & ストレージ

| 役割 | 技術 | プラン | 理由 |
|------|------|--------|------|
| Vector DB | **Pinecone** | Serverless | 無料枠あり、Vercel AI SDK統合 |
| 認証 | **Firebase Auth** | Spark/Blaze | Google/Email認証、マルチテナント |
| メタデータDB | **Firestore** | - | リアルタイム同期、柔軟なスキーマ |
| ファイル保存 | **Firebase Storage** | - | 作品画像、音声ファイル |

### インフラ & デプロイ

| 役割 | 技術 | 理由 |
|------|------|------|
| ホスティング | **Vercel** | Nuxt 4ネイティブ対応、Edge Functions |
| CDN | **Vercel Edge Network** | 自動最適化 |
| モニタリング | **Vercel Analytics** | パフォーマンス計測 |

---

## 依存パッケージ

### package.json (想定)

```json
{
  "name": "ego-graphica",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "generate": "nuxt generate"
  },
  "dependencies": {
    "nuxt": "^4.0.0",
    "vue": "^3.5.0",

    "ai": "^4.0.0",
    "@ai-sdk/vue": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",

    "@pinecone-database/pinecone": "^3.0.0",

    "firebase": "^11.0.0",
    "firebase-admin": "^12.0.0",

    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@nuxt/devtools": "latest",
    "typescript": "^5.6.0"
  }
}
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
PINECONE_INDEX=ego-graphica

# Firebase
FIREBASE_PROJECT_ID=ego-graphica
FIREBASE_CLIENT_EMAIL=xxxxx
FIREBASE_PRIVATE_KEY=xxxxx

# Firebase Client (公開可)
NUXT_PUBLIC_FIREBASE_API_KEY=xxxxx
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ego-graphica.firebaseapp.com
NUXT_PUBLIC_FIREBASE_PROJECT_ID=ego-graphica
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ego-graphica.appspot.com
```

---

## ディレクトリ構成 (想定)

```
egoGraphica/
├── nuxt.config.ts
├── app.vue
├── pages/
│   ├── index.vue              # ランディング
│   ├── artist/
│   │   └── [id]/
│   │       ├── index.vue      # アーティストページ
│   │       └── chat.vue       # チャットUI
│   └── dashboard/
│       ├── index.vue          # 管理ダッシュボード
│       ├── works.vue          # 作品管理
│       └── persona.vue        # ペルソナ設定
├── components/
│   ├── chat/
│   │   ├── ChatContainer.vue
│   │   ├── MessageBubble.vue
│   │   └── ToolResult.vue
│   └── portfolio/
│       └── WorkCard.vue
├── composables/
│   ├── useArtistChat.ts
│   └── useFirebase.ts
├── server/
│   ├── api/
│   │   ├── chat.post.ts       # メインチャットAPI
│   │   ├── ingest/
│   │   │   ├── work.post.ts   # 作品取り込み
│   │   │   └── audio.post.ts  # 音声文字起こし
│   │   └── artist/
│   │       └── [id].get.ts    # アーティスト情報取得
│   └── utils/
│       ├── pinecone.ts
│       ├── firebase-admin.ts
│       └── embedding.ts
├── types/
│   ├── artist.ts
│   ├── work.ts
│   └── chat.ts
└── llm/                        # このドキュメント群
    ├── 00-overview.md
    ├── 01-tech-stack.md
    └── ...
```

---

## 技術選定の根拠

### なぜ Claude 4.5 Opus か

1. **ペルソナ維持能力**: 長い会話でもキャラクターの一貫性を保持
2. **200Kコンテキスト**: 大量の作品情報・ペルソナ設定を同時注入可能
3. **日本語品質**: 自然な日本語での営業トーク生成
4. **Tool Calling**: 構造化された関数呼び出しに対応

### なぜ Pinecone か

1. **Serverless**: コールドスタートなし、即座にスケール
2. **Namespace**: アーティストごとにデータ分離が容易
3. **無料枠**: 100K vectors/月まで無料
4. **Vercel統合**: Edge Functionsからの低レイテンシアクセス

### なぜ Firebase か

1. **認証の即戦力**: Google/Email/Phone等、実装済み
2. **Firestore柔軟性**: スキーマレスでプロトタイピング高速
3. **Storage統合**: 大容量ファイル(作品画像、音声)の管理
4. **リアルタイム**: チャット履歴の同期が容易
