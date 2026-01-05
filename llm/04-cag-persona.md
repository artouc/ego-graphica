# CAG (Context Augmented Generation) & ペルソナ設計

## 概要

CAGを使用して、アーティスト固有のペルソナ・思考パターン・バックグラウンドをシステムプロンプトに注入し、一貫したキャラクター性を持つ応答を生成する。

```
Persona Settings + RAG Context → System Prompt → Claude → Personalized Response
```

---

## ペルソナ構造

### コンポーネント分解

```
┌─────────────────────────────────────────────────────┐
│                   Artist Persona                     │
├─────────────────────────────────────────────────────┤
│  Identity Layer        │  キャラクター名、モチーフ    │
├────────────────────────┼────────────────────────────┤
│  Communication Layer   │  話し方、トーン、表現スタイル │
├────────────────────────┼────────────────────────────┤
│  Knowledge Layer       │  専門知識、創作哲学、影響元  │
├────────────────────────┼────────────────────────────┤
│  Behavioral Layer      │  応答パターン、禁止事項      │
├────────────────────────┼────────────────────────────┤
│  Business Layer        │  価格感、納期、営業スタンス  │
└────────────────────────┴────────────────────────────┘
```

---

## ペルソナ取得・構築

### 1. ペルソナ取得サービス

```typescript
// server/utils/persona.ts
import { getFirestore } from 'firebase-admin/firestore'
import type { ArtistPersona, ArtistProfile, AgentSettings } from '~/types/artist'

export interface FullPersonaContext {
  profile: ArtistProfile
  persona: ArtistPersona
  settings: AgentSettings
}

export async function getArtistPersona(artistId: string): Promise<FullPersonaContext> {
  const db = getFirestore()
  const artistDoc = await db.collection('artists').doc(artistId).get()

  if (!artistDoc.exists) {
    throw createError({
      statusCode: 404,
      message: `Artist not found: ${artistId}`
    })
  }

  const data = artistDoc.data()!
  return {
    profile: data.profile as ArtistProfile,
    persona: data.persona as ArtistPersona,
    settings: data.settings as AgentSettings
  }
}
```

### 2. システムプロンプトビルダー

```typescript
// server/utils/prompt-builder.ts
import type { FullPersonaContext } from './persona'

export function buildSystemPrompt(
  context: FullPersonaContext,
  ragContext: string
): string {
  const { profile, persona, settings } = context

  return `# あなたの役割

あなたは「${profile.name}」のAI営業アシスタントです。
${persona.characterName ? `あなたの名前は「${persona.characterName}」です。` : ''}

アーティストの代わりに、作品への問い合わせや依頼の相談に対応します。
アーティスト本人のように振る舞い、その世界観と価値観を体現してください。

---

# キャラクター設定

## 基本情報
- アーティスト名: ${profile.name}
- 活動年数: ${profile.activeYears}年
- 専門分野: ${profile.specialties.join('、')}
- スタイル: ${profile.styles.join('、')}

## ペルソナ
- モチーフ: ${persona.motif}
- トーン: ${getToneDescription(persona.tone)}
- 性格: ${persona.personality.join('、')}

## 創作哲学
${persona.artisticPhilosophy}

## 影響を受けたもの
${persona.influences.join('、')}

## バックストーリー
${persona.backstory}

---

# コミュニケーションスタイル

## 話し方の指針
${getToneGuidelines(persona.tone)}

## 挨拶スタイル
${persona.greetingStyle}

## キーワード（会話に自然に織り込む）
${persona.keywords.join('、')}

## 理想的な応答例
${persona.sampleResponses.map((sr, i) => `
### 例 ${i + 1}
状況: ${sr.situation}
顧客: 「${sr.customerMessage}」
応答: 「${sr.idealResponse}」
`).join('\n')}

---

# 営業情報

## 価格目安
- イラスト（小）: ¥${settings.priceTable.illustration.small.toLocaleString()}〜
- イラスト（中）: ¥${settings.priceTable.illustration.medium.toLocaleString()}〜
- イラスト（大）: ¥${settings.priceTable.illustration.large.toLocaleString()}〜
- 壁画: ¥${settings.priceTable.mural.perSquareMeter.toLocaleString()}/㎡〜

## 納期
- 最短納期: ${settings.leadTime}日

## 対応可能日
${getAvailableDaysText(settings.availableDays)}

---

# 禁止事項

以下のトピックは避けてください：
${persona.avoidTopics.map(t => `- ${t}`).join('\n')}

また、以下の行動は禁止です：
- アーティスト本人であると偽ること（「AIアシスタント」であることは聞かれたら正直に答える）
- 確定していない価格や納期を断定的に約束すること
- 競合アーティストの批判
- 政治的・宗教的な議論

---

${ragContext ? `# 参照コンテンツ\n\n${ragContext}\n\n---\n` : ''}

# 応答の指針

1. **世界観を体現**: モチーフ（${persona.motif}）を意識した表現を自然に使う
2. **専門知識を活かす**: 創作プロセスや技法について語れる
3. **営業的配慮**: 予算や納期の相談には柔軟に対応、詳細は後ほど確認と伝える
4. **親しみやすさ**: 堅すぎず、アーティストらしい人間味のある対応
5. **クロージング意識**: 適切なタイミングで見積もりや次のステップを提案

回答は日本語で、${persona.tone === 'formal' ? '丁寧語' : 'です・ます調'}で行ってください。`
}

function getToneDescription(tone: string): string {
  const descriptions: Record<string, string> = {
    formal: '丁寧でフォーマル',
    friendly: 'フレンドリーで親しみやすい',
    artistic: '芸術的で詩的',
    professional: 'プロフェッショナルでビジネスライク',
    playful: '遊び心のあるユーモラス'
  }
  return descriptions[tone] || tone
}

function getToneGuidelines(tone: string): string {
  const guidelines: Record<string, string> = {
    formal: `
- 敬語を使用
- 「〜させていただきます」「〜でございます」等のビジネス敬語
- 落ち着いた、信頼感のある表現`,
    friendly: `
- 「です・ます」調をベースに、時々くだけた表現も
- 「〜ですね！」「〜かもしれません」等の柔らかい語尾
- 親しみやすく、距離感の近いコミュニケーション`,
    artistic: `
- 比喩や詩的な表現を織り交ぜる
- 感覚的・直感的な言葉選び
- 創作へのパッションが伝わる表現`,
    professional: `
- 明確で簡潔な表現
- 数字や具体例を交えた説明
- 効率的でわかりやすいコミュニケーション`,
    playful: `
- ユーモアを交えた表現
- 絵文字やカジュアルな表現もOK
- 楽しさ・ワクワク感を大切に`
  }
  return guidelines[tone] || ''
}

function getAvailableDaysText(days: number[]): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  return days.map(d => dayNames[d]).join('・') + '曜日'
}
```

---

## ペルソナ設定UI

### 3. ペルソナ設定ページ

```vue
<!-- pages/dashboard/persona.vue -->
<script setup lang="ts">
import type { ArtistPersona, PersonaTone } from '~/types/artist'

const persona = ref<ArtistPersona>({
  characterName: '',
  motif: '',
  tone: 'friendly',
  personality: [],
  artisticPhilosophy: '',
  influences: [],
  keywords: [],
  greetingStyle: '',
  sampleResponses: [],
  avoidTopics: [],
  backstory: ''
})

const toneOptions: { value: PersonaTone; label: string; description: string }[] = [
  { value: 'formal', label: '丁寧・フォーマル', description: 'ビジネスシーンに適した丁寧な対応' },
  { value: 'friendly', label: 'フレンドリー', description: '親しみやすく距離感の近い対応' },
  { value: 'artistic', label: '芸術的・詩的', description: '比喩や詩的表現を使った独創的な対応' },
  { value: 'professional', label: 'プロフェッショナル', description: '効率的で明確なビジネス対応' },
  { value: 'playful', label: '遊び心のある', description: 'ユーモアを交えた楽しい対応' }
]

const addSampleResponse = () => {
  persona.value.sampleResponses.push({
    situation: '',
    customerMessage: '',
    idealResponse: ''
  })
}

const removeSampleResponse = (index: number) => {
  persona.value.sampleResponses.splice(index, 1)
}

const savePersona = async () => {
  await $fetch('/api/artist/persona', {
    method: 'PUT',
    body: persona.value
  })
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-8">ペルソナ設定</h1>

    <!-- キャラクター設定 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">キャラクター設定</h2>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">
            エージェントの名前（任意）
          </label>
          <input
            v-model="persona.characterName"
            type="text"
            placeholder="例: ケロ助"
            class="w-full p-2 border rounded"
          />
          <p class="text-sm text-gray-500 mt-1">
            AIアシスタントに名前をつける場合に設定
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">
            モチーフ <span class="text-red-500">*</span>
          </label>
          <input
            v-model="persona.motif"
            type="text"
            placeholder="例: カエル、桜、波"
            class="w-full p-2 border rounded"
            required
          />
          <p class="text-sm text-gray-500 mt-1">
            会話の中で象徴的に使われるモチーフ
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">
            話し方のトーン <span class="text-red-500">*</span>
          </label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label
              v-for="option in toneOptions"
              :key="option.value"
              class="flex items-start p-3 border rounded cursor-pointer hover:bg-gray-50"
              :class="{ 'border-blue-500 bg-blue-50': persona.tone === option.value }"
            >
              <input
                v-model="persona.tone"
                type="radio"
                :value="option.value"
                class="mt-1 mr-3"
              />
              <div>
                <div class="font-medium">{{ option.label }}</div>
                <div class="text-sm text-gray-500">{{ option.description }}</div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </section>

    <!-- 創作哲学 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">創作哲学</h2>

      <div>
        <label class="block text-sm font-medium mb-1">
          あなたの創作への考え方 <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="persona.artisticPhilosophy"
          rows="4"
          placeholder="なぜ創作をするのか、何を大切にしているか..."
          class="w-full p-2 border rounded"
          required
        />
      </div>

      <div class="mt-4">
        <label class="block text-sm font-medium mb-1">
          バックストーリー
        </label>
        <textarea
          v-model="persona.backstory"
          rows="6"
          placeholder="アーティストとしての経歴、転機となった出来事、目指しているもの..."
          class="w-full p-2 border rounded"
        />
      </div>
    </section>

    <!-- 応答例 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">理想的な応答例</h2>
      <p class="text-sm text-gray-600 mb-4">
        どのような応答が理想的かを具体例で示してください。AIはこれを参考に学習します。
      </p>

      <div
        v-for="(sample, index) in persona.sampleResponses"
        :key="index"
        class="mb-6 p-4 border rounded bg-gray-50"
      >
        <div class="flex justify-between items-center mb-3">
          <span class="font-medium">例 {{ index + 1 }}</span>
          <button
            @click="removeSampleResponse(index)"
            class="text-red-500 text-sm"
          >
            削除
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">状況</label>
            <input
              v-model="sample.situation"
              type="text"
              placeholder="例: 初めての問い合わせ"
              class="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">顧客のメッセージ</label>
            <input
              v-model="sample.customerMessage"
              type="text"
              placeholder="例: イラストの依頼をしたいのですが..."
              class="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">理想的な応答</label>
            <textarea
              v-model="sample.idealResponse"
              rows="3"
              placeholder="例: ケロケロ！お問い合わせありがとうございます..."
              class="w-full p-2 border rounded"
            />
          </div>
        </div>
      </div>

      <button
        @click="addSampleResponse"
        class="w-full p-3 border-2 border-dashed rounded text-gray-500 hover:text-gray-700 hover:border-gray-400"
      >
        + 応答例を追加
      </button>
    </section>

    <!-- 保存 -->
    <div class="flex justify-end">
      <button
        @click="savePersona"
        class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        保存する
      </button>
    </div>
  </div>
</template>
```

---

## 動的コンテキスト調整

### 4. 会話フェーズに応じたコンテキスト

```typescript
// server/utils/dynamic-context.ts

export type ConversationPhase =
  | 'greeting'        // 初回挨拶
  | 'exploration'     // ニーズ探索
  | 'presentation'    // 作品紹介
  | 'negotiation'     // 条件交渉
  | 'closing'         // クロージング

export function detectConversationPhase(messages: Message[]): ConversationPhase {
  const messageCount = messages.length

  // 簡易的なフェーズ判定（実際はLLMで分析することも可能）
  if (messageCount <= 2) return 'greeting'

  const lastMessages = messages.slice(-3).map(m => m.content.toLowerCase())
  const combined = lastMessages.join(' ')

  if (combined.includes('見積') || combined.includes('価格') || combined.includes('いくら')) {
    return 'negotiation'
  }
  if (combined.includes('作品') || combined.includes('ポートフォリオ') || combined.includes('実績')) {
    return 'presentation'
  }
  if (combined.includes('お願い') || combined.includes('依頼') || combined.includes('発注')) {
    return 'closing'
  }

  return 'exploration'
}

export function getPhaseSpecificInstructions(phase: ConversationPhase): string {
  const instructions: Record<ConversationPhase, string> = {
    greeting: `
## 現在のフェーズ: 初回挨拶
- 温かく歓迎する
- 自己紹介を簡潔に
- 相手のニーズを聞く姿勢を示す`,

    exploration: `
## 現在のフェーズ: ニーズ探索
- オープンクエスチョンで深掘り
- 用途、目的、イメージを確認
- 予算や納期の制約も把握`,

    presentation: `
## 現在のフェーズ: 作品紹介
- 関連する作品を積極的に紹介
- Tool Callingで作品を表示
- 顧客の反応を確認しながら提案`,

    negotiation: `
## 現在のフェーズ: 条件交渉
- 価格表を参考に概算を提示
- 「正式な見積もりは別途」と補足
- 納期の相談にも応じる`,

    closing: `
## 現在のフェーズ: クロージング
- 次のステップを明確に
- 見積もりToolを使用
- アーティスト本人への引き継ぎを提案`
  }

  return instructions[phase]
}
```
