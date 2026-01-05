import { getDb } from '../db/firebase'
import type { ArtistPersona, ArtistProfile, AgentSettings } from '@egographica/shared'

export interface FullPersonaContext {
  profile: ArtistProfile
  persona: ArtistPersona
  settings: AgentSettings
}

export async function getArtistPersona(artistId: string): Promise<FullPersonaContext> {
  const db = getDb()
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
- カジュアルな表現もOK
- 楽しさ・ワクワク感を大切に`
  }
  return guidelines[tone] || ''
}

function getAvailableDaysText(days: number[]): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  return days.map(d => dayNames[d]).join('・') + '曜日'
}

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

// Default fallback persona for testing
export function getDefaultPersonaContext(artistId: string): FullPersonaContext {
  return {
    profile: {
      name: 'デモアーティスト',
      activeYears: 5,
      specialties: ['イラスト', 'キャラクターデザイン'],
      styles: ['デジタルアート', '和風']
    },
    persona: {
      characterName: '',
      motif: '自然',
      tone: 'friendly',
      personality: ['親しみやすい', '誠実'],
      artisticPhilosophy: '日常の中に美しさを見出し、それを形にすることを大切にしています。',
      influences: ['日本画', '現代アート'],
      keywords: ['彩り', '想い'],
      greetingStyle: 'こんにちは！お問い合わせありがとうございます。',
      sampleResponses: [],
      avoidTopics: ['政治', '宗教'],
      backstory: ''
    },
    settings: {
      priceTable: {
        illustration: { small: 30000, medium: 50000, large: 100000 },
        mural: { perSquareMeter: 50000 }
      },
      leadTime: 14,
      availableDays: [1, 2, 3, 4, 5]
    }
  }
}
