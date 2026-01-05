# Monorepo アーキテクチャ

## 概要

npm workspacesを使用したmonorepo構成。フロントエンド（Nuxt 4）とバックエンド（Nitro）を分離し、共有パッケージで型定義・ユーティリティを共通化。

```
┌─────────────────────────────────────────────────────────────────┐
│                         Monorepo                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   apps/                                                          │
│   ├── web/          ← Nuxt 4 (UI専用、SSR)                       │
│   │   └── Vercel                                                 │
│   │                                                              │
│   └── api/          ← Nitro Server (I/O、AI処理)                 │
│       └── Vercel Functions / Cloudflare Workers                  │
│                                                                  │
│   packages/                                                      │
│   ├── shared/       ← 共有型定義、バリデーション                   │
│   ├── ui/           ← 共有UIコンポーネント（オプション）            │
│   └── config/       ← 共有設定（ESLint、TypeScript）              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ディレクトリ構成

```
egoGraphica/
├── package.json                  # workspaces定義
├── turbo.json                    # Turborepo設定
├── .env.example
│
├── apps/
│   ├── web/                      # Nuxt 4 Frontend
│   │   ├── nuxt.config.ts
│   │   ├── package.json
│   │   ├── app.vue
│   │   ├── pages/
│   │   │   ├── index.vue
│   │   │   ├── artist/
│   │   │   │   └── [id]/
│   │   │   │       ├── index.vue
│   │   │   │       └── chat.vue
│   │   │   └── dashboard/
│   │   │       ├── index.vue
│   │   │       ├── works.vue
│   │   │       └── persona.vue
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatContainer.vue
│   │   │   │   ├── ChatInput.vue
│   │   │   │   ├── MessageBubble.vue
│   │   │   │   └── ToolResultRenderer.vue
│   │   │   └── portfolio/
│   │   │       └── WorkCard.vue
│   │   └── composables/
│   │       ├── useApi.ts          # APIクライアント
│   │       ├── useArtistChat.ts
│   │       └── useAuth.ts         # API経由の認証
│   │
│   └── api/                       # Nitro Server
│       ├── nitro.config.ts
│       ├── package.json
│       ├── routes/
│       │   ├── chat.post.ts       # POST /chat
│       │   ├── health.get.ts      # GET /health
│       │   ├── artist/
│       │   │   ├── [id].get.ts
│       │   │   └── persona.put.ts
│       │   └── ingest/
│       │       ├── work.post.ts
│       │       ├── article.post.ts
│       │       └── audio.post.ts
│       ├── utils/
│       │   ├── ai/
│       │   │   ├── claude.ts
│       │   │   ├── embedding.ts
│       │   │   └── vision.ts
│       │   ├── db/
│       │   │   ├── firebase.ts
│       │   │   └── pinecone.ts
│       │   ├── rag/
│       │   │   ├── search.ts
│       │   │   └── context.ts
│       │   └── tools/
│       │       ├── index.ts
│       │       ├── portfolio.ts
│       │       ├── quote.ts
│       │       └── availability.ts
│       └── middleware/
│           └── auth.ts
│
├── packages/
│   ├── shared/                    # 共有パッケージ
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types/
│   │   │   │   ├── artist.ts
│   │   │   │   ├── work.ts
│   │   │   │   ├── chat.ts
│   │   │   │   └── api.ts
│   │   │   ├── schemas/           # Zod スキーマ
│   │   │   │   ├── artist.ts
│   │   │   │   ├── work.ts
│   │   │   │   └── chat.ts
│   │   │   └── utils/
│   │   │       └── format.ts
│   │   └── tsconfig.json
│   │
│   └── config/                    # 共有設定
│       ├── eslint/
│       │   └── index.js
│       └── typescript/
│           └── base.json
│
└── llm/                           # ドキュメント
    ├── 00-overview.md
    └── ...
```

---

## ワークスペース設定

### ルート package.json

```json
{
  "name": "ego-graphica",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "turbo dev --filter=@egographica/web",
    "dev:api": "turbo dev --filter=@egographica/api",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.0"
  }
}
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".output/**", ".nuxt/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## apps/web (Nuxt 4 Frontend)

### package.json

```json
{
  "name": "@egographica/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "lint": "eslint .",
    "typecheck": "nuxt typecheck"
  },
  "dependencies": {
    "nuxt": "^4.0.0",
    "vue": "^3.5.0",
    "@ai-sdk/vue": "^1.0.0",
    "@egographica/shared": "*"
  },
  "devDependencies": {
    "@nuxt/devtools": "latest",
    "@egographica/config": "*"
  }
}
```

### nuxt.config.ts

```typescript
// apps/web/nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  future: {
    compatibilityVersion: 4
  },

  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  // APIサーバーへのプロキシ
  nitro: {
    devProxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001'
    }
  }
})
```

### APIクライアント

```typescript
// apps/web/composables/useApi.ts
import type { ChatRequest, ChatResponse, WorkUploadResponse } from '@egographica/shared'

export function useApi() {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiUrl

  const fetchApi = async <T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const auth = useAuth()
    const token = await auth.getIdToken()

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  return {
    // チャット（ストリーミング）
    chat: (artistId: string, messages: ChatRequest['messages']) => {
      return fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, messages })
      })
    },

    // 作品アップロード
    uploadWork: async (formData: FormData): Promise<WorkUploadResponse> => {
      const auth = useAuth()
      const token = await auth.getIdToken()

      const response = await fetch(`${baseUrl}/ingest/work`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      return response.json()
    },

    // アーティスト情報取得
    getArtist: (id: string) => fetchApi(`/artist/${id}`),

    // ペルソナ更新
    updatePersona: (data: any) => fetchApi('/artist/persona', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }
}
```

### チャットUI

```vue
<!-- apps/web/pages/artist/[id]/chat.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const route = useRoute()
const artistId = route.params.id as string
const config = useRuntimeConfig()

const { messages, input, handleSubmit, isLoading } = useChat({
  api: `${config.public.apiUrl}/chat`,
  body: {
    artistId
  }
})
</script>

<template>
  <div class="flex flex-col h-screen">
    <ChatHeader :artist-id="artistId" />

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <MessageBubble
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
    </div>

    <ChatInput
      v-model="input"
      :is-loading="isLoading"
      @submit="handleSubmit"
    />
  </div>
</template>
```

---

## apps/api (Nitro Server)

### package.json

```json
{
  "name": "@egographica/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build",
    "preview": "nitro preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "nitropack": "^2.10.0",
    "h3": "^1.13.0",

    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",

    "@pinecone-database/pinecone": "^3.0.0",
    "firebase-admin": "^12.0.0",

    "zod": "^3.23.0",
    "@egographica/shared": "*"
  },
  "devDependencies": {
    "@egographica/config": "*"
  }
}
```

### nitro.config.ts

```typescript
// apps/api/nitro.config.ts
import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  preset: 'vercel',  // or 'cloudflare-module'

  routeRules: {
    '/chat': {
      // ストリーミング対応
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    }
  },

  runtimeConfig: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    pineconeApiKey: process.env.PINECONE_API_KEY,
    pineconeIndex: process.env.PINECONE_INDEX,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY
  },

  // CORS設定
  handlers: [
    {
      route: '/**',
      handler: '~/middleware/cors.ts'
    }
  ]
})
```

### チャットAPI

```typescript
// apps/api/routes/chat.post.ts
import { defineEventHandler, readBody, setResponseHeader } from 'h3'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { ChatRequestSchema } from '@egographica/shared'
import { searchRelevantContent, buildRAGContext } from '../utils/rag/search'
import { getArtistPersona, buildSystemPrompt } from '../utils/rag/context'
import { analyzeImage } from '../utils/ai/vision'
import { chatTools } from '../utils/tools'

export default defineEventHandler(async (event) => {
  // バリデーション
  const body = await readBody(event)
  const { artistId, messages } = ChatRequestSchema.parse(body)

  // 最新のユーザーメッセージ
  const lastMessage = messages.at(-1)
  let enhancedQuery = lastMessage?.content || ''
  let imageContext = ''

  // 画像が添付されている場合
  if (hasImageAttachment(lastMessage)) {
    const imageUrl = extractImageUrl(lastMessage)
    const analysis = await analyzeImage(imageUrl)
    imageContext = buildImageContext(analysis)
    enhancedQuery = `${analysis.searchableDescription} ${enhancedQuery}`
  }

  // RAG検索 & ペルソナ取得
  const [ragResults, persona] = await Promise.all([
    searchRelevantContent(artistId, enhancedQuery, { topK: 5 }),
    getArtistPersona(artistId)
  ])

  const ragContext = buildRAGContext(ragResults)
  const systemPrompt = buildSystemPrompt(persona, ragContext + imageContext)

  // ストリーミングレスポンス
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  const result = streamText({
    model: anthropic('claude-opus-4-5-20250514'),
    system: systemPrompt,
    messages: convertMessages(messages),
    tools: chatTools(artistId),
    maxTokens: 4096,
    temperature: 0.7
  })

  return result.toDataStreamResponse()
})
```

### 作品アップロードAPI

```typescript
// apps/api/routes/ingest/work.post.ts
import { defineEventHandler, readFormData } from 'h3'
import { WorkUploadSchema } from '@egographica/shared'
import { analyzeImage } from '../../utils/ai/vision'
import { embedText } from '../../utils/ai/embedding'
import { upsertVector } from '../../utils/db/pinecone'
import { getDb, getStorage } from '../../utils/db/firebase'

export default defineEventHandler(async (event) => {
  // 認証チェック
  const artistId = await requireAuth(event)

  const formData = await readFormData(event)
  const images = formData.getAll('images') as File[]
  const metadata = WorkUploadSchema.parse(
    JSON.parse(formData.get('metadata') as string)
  )

  const db = getDb()
  const storage = getStorage()

  // 1. 画像をStorageにアップロード
  const uploadedImages = await uploadImages(images, artistId, storage)
  const primaryImageUrl = uploadedImages[0].url

  // 2. Claude Visionで画像分析
  const imageAnalysis = await analyzeImage(primaryImageUrl, {
    title: metadata.title,
    category: metadata.category
  })

  // 3. 検索用テキスト構築
  const searchableText = buildSearchableText(metadata, imageAnalysis)

  // 4. Firestoreに保存
  const workRef = db.collection('works').doc()
  await workRef.set({
    id: workRef.id,
    artistId,
    ...metadata,
    images: uploadedImages,
    imageAnalysis,
    searchableText,
    createdAt: new Date(),
    updatedAt: new Date()
  })

  // 5. Embedding & Pineconeインデックス
  const embedding = await embedText(searchableText)
  await upsertVector(artistId, `work_${workRef.id}`, embedding, {
    artistId,
    type: 'work',
    sourceId: workRef.id,
    title: metadata.title,
    category: metadata.category,
    tags: [...(metadata.tags || []), ...imageAnalysis.meta.suggestedTags],
    colors: imageAnalysis.visual.dominantColors,
    style: imageAnalysis.visual.style,
    mood: imageAnalysis.content.mood,
    text: searchableText.slice(0, 1000),
    createdAt: new Date().toISOString()
  })

  return {
    success: true,
    workId: workRef.id,
    imageAnalysis
  }
})
```

### CORSミドルウェア

```typescript
// apps/api/middleware/cors.ts
import { defineEventHandler, setResponseHeaders, getMethod } from 'h3'

export default defineEventHandler((event) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://ego-graphica.vercel.app',
    process.env.WEB_URL
  ].filter(Boolean)

  const origin = event.node.req.headers.origin || ''

  if (allowedOrigins.includes(origin)) {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    })
  }

  // Preflight
  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.end()
    return
  }
})
```

---

## packages/shared

### package.json

```json
{
  "name": "@egographica/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.6.0"
  }
}
```

### 型定義

```typescript
// packages/shared/src/types/artist.ts
import type { Timestamp } from 'firebase-admin/firestore'

export interface Artist {
  id: string
  createdAt: Timestamp
  updatedAt: Timestamp
  profile: ArtistProfile
  persona: ArtistPersona
  settings: AgentSettings
}

export interface ArtistProfile {
  name: string
  nameKana?: string
  email: string
  bio: string
  website?: string
  socialLinks: {
    twitter?: string
    instagram?: string
    behance?: string
  }
  profileImageUrl?: string
  specialties: string[]
  styles: string[]
}

export interface ArtistPersona {
  characterName?: string
  motif: string
  tone: 'formal' | 'friendly' | 'artistic' | 'professional' | 'playful'
  personality: string[]
  artisticPhilosophy: string
  influences: string[]
  keywords: string[]
  greetingStyle: string
  sampleResponses: SampleResponse[]
  avoidTopics: string[]
  backstory: string
}

export interface SampleResponse {
  situation: string
  customerMessage: string
  idealResponse: string
}

export interface AgentSettings {
  isActive: boolean
  autoReply: boolean
  priceTable: PriceTable
  currency: 'JPY' | 'USD'
  leadTime: number
}

export interface PriceTable {
  illustration: { small: number; medium: number; large: number }
  mural: { perSquareMeter: number; minimumCharge: number }
  collaboration: { hourlyRate: number; minimumHours: number }
}
```

### Zodスキーマ

```typescript
// packages/shared/src/schemas/chat.ts
import { z } from 'zod'

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([
    z.string(),
    z.array(z.object({
      type: z.enum(['text', 'image']),
      text: z.string().optional(),
      source: z.object({
        type: z.enum(['url', 'base64']),
        url: z.string().optional(),
        media_type: z.string().optional(),
        data: z.string().optional()
      }).optional()
    }))
  ])
})

export const ChatRequestSchema = z.object({
  artistId: z.string().min(1),
  messages: z.array(MessageSchema)
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

// packages/shared/src/schemas/work.ts
export const WorkUploadSchema = z.object({
  title: z.string().min(1).max(100),
  titleEn: z.string().optional(),
  description: z.string().optional(),
  category: z.enum([
    'illustration', 'painting', 'mural',
    'graphic_design', 'character_design', 'concept_art'
  ]).default('illustration'),
  tags: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  isPublic: z.boolean().default(true),
  isFeatured: z.boolean().default(false)
})

export type WorkUpload = z.infer<typeof WorkUploadSchema>
```

### エントリポイント

```typescript
// packages/shared/src/index.ts

// Types
export type {
  Artist,
  ArtistProfile,
  ArtistPersona,
  AgentSettings,
  PriceTable
} from './types/artist'

export type {
  Work,
  WorkCategory,
  WorkImage,
  ImageAnalysis
} from './types/work'

export type {
  ChatRequest,
  Message,
  Conversation
} from './types/chat'

// Schemas
export {
  ChatRequestSchema,
  MessageSchema
} from './schemas/chat'

export {
  WorkUploadSchema
} from './schemas/work'

export {
  ArtistPersonaSchema
} from './schemas/artist'

// Utils
export { formatPrice, formatDate } from './utils/format'
```

---

## デプロイ構成

### Vercel（マルチアプリ）

```json
// apps/web/vercel.json
{
  "framework": "nuxtjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".output"
}
```

```json
// apps/api/vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".output",
  "functions": {
    "**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### 環境変数

```bash
# Vercel: @egographica/web
NUXT_PUBLIC_API_URL=https://api.egographica.com

# Vercel: @egographica/api
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX=egographica
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
WEB_URL=https://egographica.com
```

---

## 開発ワークフロー

```bash
# セットアップ
npm install

# 全体開発
npm run dev

# 個別開発
npm run dev:web    # http://localhost:3000
npm run dev:api    # http://localhost:3001

# ビルド
npm run build

# 型チェック
npm run typecheck

# Lint
npm run lint
```

---

## アーキテクチャ図（更新版）

```
┌─────────────────────────────────────────────────────────────────┐
│                         Monorepo                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐         ┌─────────────────────┐        │
│  │   apps/web          │  HTTP   │   apps/api          │        │
│  │   (Nuxt 4)          │ ◀─────▶ │   (Nitro)           │        │
│  │                     │         │                     │        │
│  │  • UI Components    │         │  • /chat            │        │
│  │  • Pages            │         │  • /ingest/*        │        │
│  │  • @ai-sdk/vue      │         │  • /artist/*        │        │
│  │                     │         │  • firebase-admin   │        │
│  │                     │         │  • Vision Analysis  │        │
│  └──────────┬──────────┘         └──────────┬──────────┘        │
│             │                               │                    │
│             │    ┌─────────────────────┐    │                    │
│             └───▶│  packages/shared    │◀───┘                    │
│                  │  • Types            │                         │
│                  │  • Zod Schemas      │                         │
│                  │  • Utils            │                         │
│                  └─────────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ Firebase │         │ Pinecone │         │ Claude   │
  │ (Admin)  │         │          │         │ 4.5 Opus │
  │          │         │ • Vector │         │          │
  │ • Auth   │         │ • Search │         │ • Chat   │
  │ • Store  │         │          │         │ • Vision │
  │ • Storage│         │          │         │          │
  └──────────┘         └──────────┘         └──────────┘

※ Firebase操作はすべてAPIサーバー（firebase-admin）経由
  クライアントにFirebase SDKは使用しない
```
