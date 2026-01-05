# デプロイ構成

> **Note**: Monorepo構成（Nuxt + Nitro分離）については [09-monorepo-architecture.md](./09-monorepo-architecture.md) を参照してください。
> 以下は単一アプリ構成の参考情報です。

## 概要

Nuxt 4をVercelにデプロイし、Firebase（Auth/Firestore/Storage）とPineconeをバックエンドとして使用する構成。

```
┌──────────────────────────────────────────────────────────────┐
│                         Vercel                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Nuxt 4 Application                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │  │
│  │  │   Pages     │  │ Components  │  │  Composables  │  │  │
│  │  │   (SSR)     │  │    (Vue)    │  │   (Vue 3.5)   │  │  │
│  │  └─────────────┘  └─────────────┘  └───────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │            Server Routes (Edge)                  │  │  │
│  │  │    /api/chat, /api/ingest/*, /api/artist/*      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
     ┌──────────┐         ┌──────────┐         ┌──────────┐
     │ Firebase │         │ Pinecone │         │ Claude   │
     │ Auth/DB  │         │ Vector   │         │ 4.5 Opus │
     │ Storage  │         │ Index    │         │          │
     └──────────┘         └──────────┘         └──────────┘
```

---

## Nuxt 4 設定

### nuxt.config.ts

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  future: {
    compatibilityVersion: 4
  },

  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  // Vercel Edge Runtime
  nitro: {
    preset: 'vercel-edge',

    // Server Routes設定
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
          'Access-Control-Allow-Origin': '*'
        }
      },
      // チャットAPIはストリーミングのためEdge Runtime
      '/api/chat': {
        // Edge Functions
      }
    }
  },

  // Runtime Config
  runtimeConfig: {
    // Server-only
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    pineconeApiKey: process.env.PINECONE_API_KEY,
    pineconeIndex: process.env.PINECONE_INDEX,

    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,

    // Public (client-side)
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    }
  },

  // App Config
  app: {
    head: {
      title: 'egoGraphica',
      meta: [
        { name: 'description', content: 'Artist AI Agent Platform' }
      ]
    }
  }
})
```

---

## Vercel 設定

### vercel.json

```json
{
  "framework": "nuxtjs",
  "buildCommand": "nuxt build",
  "outputDirectory": ".output",
  "installCommand": "pnpm install",

  "functions": {
    "api/**/*.ts": {
      "maxDuration": 60
    }
  },

  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
        { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" }
      ]
    }
  ],

  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 環境変数設定

```bash
# Vercel CLIで環境変数を設定
vercel env add ANTHROPIC_API_KEY production
vercel env add OPENAI_API_KEY production
vercel env add PINECONE_API_KEY production
vercel env add PINECONE_INDEX production

vercel env add FIREBASE_PROJECT_ID production
vercel env add FIREBASE_CLIENT_EMAIL production
vercel env add FIREBASE_PRIVATE_KEY production

vercel env add NUXT_PUBLIC_FIREBASE_API_KEY production
vercel env add NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
vercel env add NUXT_PUBLIC_FIREBASE_PROJECT_ID production
vercel env add NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET production
```

---

## Firebase 設定

### Firebase初期化（クライアント側）

```typescript
// plugins/firebase.client.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: config.public.firebaseStorageBucket
  }

  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)

  return {
    provide: {
      firebase: { app, auth, db, storage }
    }
  }
})
```

### Firebase Admin初期化（サーバー側）

```typescript
// server/utils/firebase-admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'

let initialized = false

export function initFirebaseAdmin() {
  if (initialized || getApps().length > 0) return

  const config = useRuntimeConfig()

  initializeApp({
    credential: cert({
      projectId: config.firebaseProjectId,
      clientEmail: config.firebaseClientEmail,
      privateKey: config.firebasePrivateKey?.replace(/\\n/g, '\n')
    }),
    storageBucket: `${config.firebaseProjectId}.appspot.com`
  })

  initialized = true
}

export function getDb() {
  initFirebaseAdmin()
  return getFirestore()
}

export function getAdminAuth() {
  initFirebaseAdmin()
  return getAuth()
}

export function getAdminStorage() {
  initFirebaseAdmin()
  return getStorage()
}
```

### Firebase Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // アーティスト情報
    match /artists/{artistId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == artistId;
    }

    // 作品
    match /works/{workId} {
      allow read: if resource.data.isPublic == true
                  || (request.auth != null && request.auth.uid == resource.data.artistId);
      allow write: if request.auth != null && request.auth.uid == resource.data.artistId;
    }

    // 記事
    match /articles/{articleId} {
      allow read: if resource.data.isPublic == true
                  || (request.auth != null && request.auth.uid == resource.data.artistId);
      allow write: if request.auth != null && request.auth.uid == resource.data.artistId;
    }

    // ポッドキャスト
    match /podcasts/{podcastId} {
      allow read: if resource.data.isPublic == true
                  || (request.auth != null && request.auth.uid == resource.data.artistId);
      allow write: if request.auth != null && request.auth.uid == resource.data.artistId;
    }

    // 会話（誰でも作成可能、アーティストのみ管理可能）
    match /conversations/{conversationId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if request.auth != null
                            && request.auth.uid == resource.data.artistId;

      match /messages/{messageId} {
        allow read: if true;
        allow create: if true;
      }
    }

    // 見積もり
    match /quotes/{quoteId} {
      allow read: if request.auth != null
                  && (request.auth.uid == resource.data.artistId
                      || request.auth.token.email == resource.data.customer.email);
      allow write: if request.auth != null && request.auth.uid == resource.data.artistId;
    }
  }
}
```

---

## Pinecone 設定

### インデックス作成

```bash
# Pinecone Consoleで作成、またはAPI経由

# Index設定:
# - Name: ego-graphica
# - Dimensions: 1536 (text-embedding-3-small)
# - Metric: cosine
# - Pod Type: Serverless
# - Region: us-east-1 (Vercelに近い)
```

### Pinecone初期化

```typescript
// server/utils/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone'

let pineconeClient: Pinecone | null = null

export function getPinecone() {
  if (!pineconeClient) {
    const config = useRuntimeConfig()
    pineconeClient = new Pinecone({
      apiKey: config.pineconeApiKey
    })
  }
  return pineconeClient
}

export function getIndex() {
  const config = useRuntimeConfig()
  return getPinecone().index(config.pineconeIndex)
}
```

---

## デプロイフロー

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Type check
        run: pnpm nuxi typecheck

      - name: Lint
        run: pnpm lint

      - name: Install Vercel CLI
        run: pnpm add -g vercel

      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## 開発環境セットアップ

### ローカル開発

```bash
# 1. リポジトリクローン
git clone https://github.com/your-org/ego-graphica.git
cd ego-graphica

# 2. 依存関係インストール
pnpm install

# 3. 環境変数設定
cp .env.example .env.local
# .env.localを編集

# 4. Firebase エミュレータ起動（オプション）
firebase emulators:start

# 5. 開発サーバー起動
pnpm dev
```

### .env.example

```env
# Anthropic
ANTHROPIC_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Pinecone
PINECONE_API_KEY=
PINECONE_INDEX=ego-graphica-dev

# Firebase Admin
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Client
NUXT_PUBLIC_FIREBASE_API_KEY=
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NUXT_PUBLIC_FIREBASE_PROJECT_ID=
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
```

---

## 監視・運用

### Vercel Analytics

```typescript
// nuxt.config.ts に追加
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@vercel/analytics/nuxt'  // Vercel Analytics
  ]
})
```

### エラー監視（Sentry）

```typescript
// plugins/sentry.client.ts
import * as Sentry from '@sentry/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  if (config.public.sentryDsn) {
    Sentry.init({
      app: nuxtApp.vueApp,
      dsn: config.public.sentryDsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1
    })
  }
})
```

### ヘルスチェック

```typescript
// server/api/health.get.ts
export default defineEventHandler(async () => {
  const checks = {
    firebase: false,
    pinecone: false,
    anthropic: false
  }

  try {
    // Firebase接続確認
    const db = getDb()
    await db.collection('_health').doc('ping').get()
    checks.firebase = true
  } catch {}

  try {
    // Pinecone接続確認
    const index = getIndex()
    await index.describeIndexStats()
    checks.pinecone = true
  } catch {}

  try {
    // Anthropic API確認
    const config = useRuntimeConfig()
    checks.anthropic = !!config.anthropicApiKey
  } catch {}

  const allHealthy = Object.values(checks).every(Boolean)

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }
})
```

---

## 本番チェックリスト

- [ ] 環境変数がすべて設定されている
- [ ] Firebase Security Rulesがデプロイされている
- [ ] Pineconeインデックスが作成されている
- [ ] ドメインが設定されている
- [ ] SSL証明書が有効
- [ ] CORS設定が正しい
- [ ] エラー監視が有効
- [ ] バックアップ戦略が設定されている
