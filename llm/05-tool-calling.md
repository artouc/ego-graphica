# Tool Calling 実装

## 概要

Vercel AI SDKのTool Calling機能を使用して、AIエージェントが外部システムと連携し、以下のアクションを実行可能にする：

- 作品ポートフォリオの表示
- スケジュール空き状況の確認
- 概算見積もりの生成
- 問い合わせフォームの表示

```
User Message → Claude Analysis → Tool Selection → Execute → Format Response
```

---

## ツール定義

### 1. ツール一覧

```typescript
// server/utils/tools.ts
import { tool } from 'ai'
import { z } from 'zod'
import { getFirestore } from 'firebase-admin/firestore'

export function chatTools(artistId: string) {
  return {
    showPortfolio,
    checkAvailability: checkAvailabilityTool(artistId),
    generateQuote: generateQuoteTool(artistId),
    showContactForm,
    searchWorks: searchWorksTool(artistId)
  }
}
```

### 2. ポートフォリオ表示ツール

```typescript
// server/utils/tools/portfolio.ts
import { tool } from 'ai'
import { z } from 'zod'

export const showPortfolio = tool({
  description: `アーティストの作品ポートフォリオを表示します。
カテゴリや特定のスタイルで絞り込むことができます。
顧客が作品を見たい、実績を知りたいと言った場合に使用してください。`,

  parameters: z.object({
    category: z.enum([
      'illustration',
      'painting',
      'mural',
      'graphic_design',
      'character_design',
      'concept_art',
      'all'
    ]).optional().describe('作品カテゴリ'),

    style: z.string().optional().describe('スタイル（和風、ポップなど）'),

    limit: z.number().min(1).max(10).default(4).describe('表示する作品数'),

    featured: z.boolean().optional().describe('代表作のみ表示')
  }),

  execute: async ({ category, style, limit, featured }) => {
    const db = getFirestore()
    let query = db.collection('works')
      .where('artistId', '==', artistId)
      .where('isPublic', '==', true)

    if (category && category !== 'all') {
      query = query.where('category', '==', category)
    }

    if (featured) {
      query = query.where('isFeatured', '==', true)
    }

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const works = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title,
        category: data.category,
        description: data.description?.slice(0, 100),
        imageUrl: data.images?.[0]?.thumbnailUrl || data.images?.[0]?.url,
        year: data.year,
        tags: data.tags?.slice(0, 5)
      }
    })

    // スタイルでフィルタリング（Firestoreでは配列のcontains検索が必要）
    const filteredWorks = style
      ? works.filter(w => w.tags?.some(t =>
          t.toLowerCase().includes(style.toLowerCase())
        ))
      : works

    return {
      success: true,
      works: filteredWorks,
      count: filteredWorks.length,
      displayComponent: 'PortfolioGrid'  // フロントエンドで使用するコンポーネント
    }
  }
})
```

### 3. スケジュール確認ツール

```typescript
// server/utils/tools/availability.ts
import { tool } from 'ai'
import { z } from 'zod'

export function checkAvailabilityTool(artistId: string) {
  return tool({
    description: `アーティストのスケジュール空き状況を確認します。
納期の相談や、いつから対応可能かを確認したい場合に使用してください。`,

    parameters: z.object({
      month: z.string().describe('確認したい月（YYYY-MM形式）'),

      projectType: z.enum([
        'illustration',
        'mural',
        'collaboration',
        'other'
      ]).optional().describe('プロジェクトの種類')
    }),

    execute: async ({ month, projectType }) => {
      const db = getFirestore()

      // アーティストの設定を取得
      const artistDoc = await db.collection('artists').doc(artistId).get()
      const settings = artistDoc.data()?.settings

      // 繁忙期チェック
      const targetDate = new Date(`${month}-01`)
      const busyPeriods = settings?.busyPeriods || []
      const isBusyMonth = busyPeriods.some((period: any) => {
        const start = period.startDate.toDate()
        const end = period.endDate.toDate()
        return targetDate >= start && targetDate <= end
      })

      // 既存プロジェクトの確認（簡易版）
      const existingProjects = await db.collection('quotes')
        .where('artistId', '==', artistId)
        .where('status', '==', 'accepted')
        .get()

      const projectsInMonth = existingProjects.docs.filter(doc => {
        const deliveryDate = doc.data().deliveryDate?.toDate()
        if (!deliveryDate) return false
        return deliveryDate.getFullYear() === targetDate.getFullYear() &&
               deliveryDate.getMonth() === targetDate.getMonth()
      })

      // 空き状況判定
      let availability: 'available' | 'limited' | 'busy'
      let message: string

      if (isBusyMonth) {
        availability = 'busy'
        message = `${month}は繁忙期のため、新規のお受けが難しい状況です。翌月以降でしたらご相談可能です。`
      } else if (projectsInMonth.length >= 3) {
        availability = 'limited'
        message = `${month}は既にいくつかのプロジェクトが入っておりますが、スケジュール次第ではご相談可能です。`
      } else {
        availability = 'available'
        message = `${month}は比較的余裕がございます。ぜひご相談ください。`
      }

      return {
        success: true,
        month,
        availability,
        message,
        leadTime: settings?.leadTime || 14,
        existingProjectCount: projectsInMonth.length,
        displayComponent: 'AvailabilityCalendar'
      }
    }
  })
}
```

### 4. 見積もり生成ツール

```typescript
// server/utils/tools/quote.ts
import { tool } from 'ai'
import { z } from 'zod'

export function generateQuoteTool(artistId: string) {
  return tool({
    description: `概算見積もりを生成します。
価格を知りたい、見積もりが欲しいという場合に使用してください。
正式な見積もりではなく、参考価格として提示します。`,

    parameters: z.object({
      projectType: z.enum([
        'illustration_small',
        'illustration_medium',
        'illustration_large',
        'mural',
        'character_design',
        'collaboration'
      ]).describe('プロジェクトの種類'),

      description: z.string().describe('依頼内容の概要'),

      quantity: z.number().min(1).default(1).describe('数量'),

      rushOrder: z.boolean().default(false).describe('急ぎかどうか'),

      additionalOptions: z.array(z.string()).optional().describe('追加オプション')
    }),

    execute: async ({ projectType, description, quantity, rushOrder, additionalOptions }) => {
      const db = getFirestore()

      // 価格表取得
      const artistDoc = await db.collection('artists').doc(artistId).get()
      const priceTable = artistDoc.data()?.settings?.priceTable

      if (!priceTable) {
        return {
          success: false,
          error: '価格設定が見つかりません'
        }
      }

      // 基本価格計算
      let basePrice: number
      let category: string

      switch (projectType) {
        case 'illustration_small':
          basePrice = priceTable.illustration.small
          category = 'イラスト（小）'
          break
        case 'illustration_medium':
          basePrice = priceTable.illustration.medium
          category = 'イラスト（中）'
          break
        case 'illustration_large':
          basePrice = priceTable.illustration.large
          category = 'イラスト（大）'
          break
        case 'mural':
          basePrice = priceTable.mural.minimumCharge
          category = '壁画'
          break
        case 'character_design':
          basePrice = priceTable.illustration.medium * 1.5
          category = 'キャラクターデザイン'
          break
        case 'collaboration':
          basePrice = priceTable.collaboration.hourlyRate * priceTable.collaboration.minimumHours
          category = 'コラボレーション'
          break
        default:
          basePrice = priceTable.illustration.medium
          category = 'その他'
      }

      // 数量計算
      let subtotal = basePrice * quantity

      // 急ぎ料金
      if (rushOrder) {
        subtotal *= 1.3  // 30%増
      }

      // 税計算
      const tax = Math.floor(subtotal * 0.1)
      const total = subtotal + tax

      const quoteItems = [
        {
          description: category,
          quantity,
          unitPrice: basePrice,
          amount: basePrice * quantity
        }
      ]

      if (rushOrder) {
        quoteItems.push({
          description: '特急料金（30%）',
          quantity: 1,
          unitPrice: Math.floor(basePrice * quantity * 0.3),
          amount: Math.floor(basePrice * quantity * 0.3)
        })
      }

      return {
        success: true,
        quote: {
          items: quoteItems,
          subtotal,
          tax,
          total,
          currency: 'JPY',
          validDays: 14,
          notes: [
            'この金額は概算です。正式な見積もりは詳細をお聞きした上でお出しします。',
            '修正回数は2回まで含まれています。追加修正は別途お見積りとなります。',
            description
          ]
        },
        displayComponent: 'QuotePreview'
      }
    }
  })
}
```

### 5. 作品検索ツール

```typescript
// server/utils/tools/search.ts
import { tool } from 'ai'
import { z } from 'zod'
import { searchRelevantContent } from '../rag'

export function searchWorksTool(artistId: string) {
  return tool({
    description: `特定のキーワードや要望に合った作品を検索します。
「こんな感じの作品ありますか？」「〇〇っぽいもの」といった曖昧な要望に対応します。`,

    parameters: z.object({
      query: z.string().describe('検索クエリ（自然言語）'),

      types: z.array(z.enum(['work', 'article', 'podcast']))
        .optional()
        .describe('検索対象の種類')
    }),

    execute: async ({ query, types }) => {
      const results = await searchRelevantContent(artistId, query, {
        topK: 5,
        types: types as any,
        minScore: 0.6,
        includeFullData: true
      })

      return {
        success: true,
        results: results.map(r => ({
          type: r.type,
          title: r.title,
          snippet: r.snippet,
          relevance: Math.round(r.score * 100),
          data: r.fullData
        })),
        count: results.length,
        displayComponent: 'SearchResults'
      }
    }
  })
}
```

### 6. 問い合わせフォーム表示ツール

```typescript
// server/utils/tools/contact.ts
import { tool } from 'ai'
import { z } from 'zod'

export const showContactForm = tool({
  description: `正式な問い合わせフォームを表示します。
詳しい相談をしたい、正式に依頼したいという場合に使用してください。`,

  parameters: z.object({
    prefillData: z.object({
      projectType: z.string().optional(),
      budget: z.string().optional(),
      deadline: z.string().optional(),
      description: z.string().optional()
    }).optional().describe('フォームの事前入力データ')
  }),

  execute: async ({ prefillData }) => {
    return {
      success: true,
      message: '以下のフォームからお問い合わせください。担当者が確認次第、ご連絡いたします。',
      prefillData,
      displayComponent: 'ContactForm'
    }
  }
})
```

---

## フロントエンド表示コンポーネント

### ToolResultRenderer

```vue
<!-- components/chat/ToolResultRenderer.vue -->
<script setup lang="ts">
interface Props {
  toolName: string
  result: Record<string, unknown>
}

const props = defineProps<Props>()

const componentMap: Record<string, string> = {
  PortfolioGrid: 'ChatPortfolioGrid',
  AvailabilityCalendar: 'ChatAvailabilityCalendar',
  QuotePreview: 'ChatQuotePreview',
  SearchResults: 'ChatSearchResults',
  ContactForm: 'ChatContactForm'
}

const componentName = computed(() => {
  const displayComponent = props.result.displayComponent as string
  return componentMap[displayComponent] || 'ChatGenericResult'
})
</script>

<template>
  <component
    :is="componentName"
    :data="result"
    class="my-4"
  />
</template>
```

### PortfolioGrid

```vue
<!-- components/chat/ChatPortfolioGrid.vue -->
<script setup lang="ts">
interface Work {
  id: string
  title: string
  imageUrl: string
  category: string
  year: number
}

interface Props {
  data: {
    works: Work[]
    count: number
  }
}

const props = defineProps<Props>()
</script>

<template>
  <div class="bg-gray-50 rounded-lg p-4">
    <div class="text-sm text-gray-600 mb-3">
      {{ data.count }}件の作品が見つかりました
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div
        v-for="work in data.works"
        :key="work.id"
        class="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      >
        <img
          :src="work.imageUrl"
          :alt="work.title"
          class="w-full h-32 object-cover"
        />
        <div class="p-2">
          <div class="font-medium text-sm truncate">{{ work.title }}</div>
          <div class="text-xs text-gray-500">{{ work.year }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
```

### QuotePreview

```vue
<!-- components/chat/ChatQuotePreview.vue -->
<script setup lang="ts">
interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

interface Props {
  data: {
    quote: {
      items: QuoteItem[]
      subtotal: number
      tax: number
      total: number
      currency: string
      notes: string[]
    }
  }
}

const props = defineProps<Props>()

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: props.data.quote.currency
  }).format(price)
}
</script>

<template>
  <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
    <div class="font-semibold text-blue-800 mb-3">概算見積もり</div>

    <table class="w-full text-sm mb-4">
      <thead>
        <tr class="border-b">
          <th class="text-left py-2">内容</th>
          <th class="text-right py-2">数量</th>
          <th class="text-right py-2">金額</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data.quote.items" :key="item.description">
          <td class="py-2">{{ item.description }}</td>
          <td class="text-right py-2">{{ item.quantity }}</td>
          <td class="text-right py-2">{{ formatPrice(item.amount) }}</td>
        </tr>
      </tbody>
      <tfoot class="border-t">
        <tr>
          <td colspan="2" class="text-right py-2">小計</td>
          <td class="text-right py-2">{{ formatPrice(data.quote.subtotal) }}</td>
        </tr>
        <tr>
          <td colspan="2" class="text-right py-2">消費税</td>
          <td class="text-right py-2">{{ formatPrice(data.quote.tax) }}</td>
        </tr>
        <tr class="font-bold">
          <td colspan="2" class="text-right py-2">合計</td>
          <td class="text-right py-2 text-lg">{{ formatPrice(data.quote.total) }}</td>
        </tr>
      </tfoot>
    </table>

    <div class="text-xs text-gray-600 space-y-1">
      <div v-for="note in data.quote.notes" :key="note">
        ※ {{ note }}
      </div>
    </div>
  </div>
</template>
```

---

## ツール使用のプロンプト指示

```typescript
// システムプロンプトに追加
const toolUsageInstructions = `
# ツール使用の指針

以下のツールが利用可能です。適切なタイミングで積極的に使用してください。

## showPortfolio
- 「作品を見たい」「実績は？」「どんな絵を描くの？」といった質問に対応
- featured: true で代表作を優先表示

## checkAvailability
- 「いつから対応できる？」「〇月は空いてる？」といった質問に対応
- 納期相談の際に自動で確認

## generateQuote
- 「いくらくらい？」「見積もりが欲しい」といった質問に対応
- 必ず「概算」であることを伝える

## searchWorks
- 「こんな感じのある？」「〇〇っぽいもの」といった曖昧な検索に対応
- RAGベースでセマンティック検索

## showContactForm
- 「正式に依頼したい」「詳しく相談したい」という場合
- 会話の締めくくりとして提案

ツールの結果は自動的にUI表示されます。
結果を受けて、自然な言葉で補足説明を加えてください。
`
```
