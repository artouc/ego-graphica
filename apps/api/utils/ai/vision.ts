import Anthropic from '@anthropic-ai/sdk'

let anthropicClient: Anthropic | null = null

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const config = useRuntimeConfig()

    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured')
    }

    anthropicClient = new Anthropic({
      apiKey: config.anthropicApiKey
    })
  }
  return anthropicClient
}

export interface ImageAnalysis {
  visual: {
    dominantColors: string[]
    colorMood: string
    composition: string
    style: string
    technique: string
  }
  content: {
    subject: string
    elements: string[]
    mood: string
    narrative: string
  }
  meta: {
    suggestedTags: string[]
    similarStyles: string[]
    targetAudience: string
    useCase: string[]
  }
  searchableDescription: string
}

const ANALYSIS_PROMPT = `この作品画像を詳細に分析してください。

以下のJSON形式で出力してください：

{
  "visual": {
    "dominantColors": ["色1", "色2", "色3"],
    "colorMood": "色の全体的な印象",
    "composition": "構図の特徴",
    "style": "アートスタイル",
    "technique": "技法・画材の印象"
  },
  "content": {
    "subject": "主題・モチーフ",
    "elements": ["要素1", "要素2"],
    "mood": "作品の雰囲気",
    "narrative": "この作品が語りかける物語や感情（2-3文）"
  },
  "meta": {
    "suggestedTags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
    "similarStyles": ["類似するアートスタイルや作家"],
    "targetAudience": "この作品が響きそうな層",
    "useCase": ["適した用途1", "適した用途2"]
  },
  "searchableDescription": "この作品を検索で見つけやすくするための自然言語での詳細な説明（100-200字）"
}

JSONのみを出力してください。`

export async function analyzeImage(
  imageUrl: string,
  existingMetadata?: {
    title?: string
    artistStyle?: string
    category?: string
  }
): Promise<ImageAnalysis> {
  const anthropic = getAnthropic()

  const contextHint = existingMetadata
    ? `
参考情報:
- タイトル: ${existingMetadata.title || '不明'}
- アーティストのスタイル: ${existingMetadata.artistStyle || '不明'}
- カテゴリ: ${existingMetadata.category || '不明'}
`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              url: imageUrl
            }
          },
          {
            type: 'text',
            text: `${contextHint}\n${ANALYSIS_PROMPT}`
          }
        ]
      }
    ]
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude Vision')
  }

  // Remove code blocks if present
  const jsonStr = content.text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(jsonStr) as ImageAnalysis
}

export async function analyzeImageBase64(
  base64Data: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  existingMetadata?: {
    title?: string
    artistStyle?: string
    category?: string
  }
): Promise<ImageAnalysis> {
  const anthropic = getAnthropic()

  const contextHint = existingMetadata
    ? `
参考情報:
- タイトル: ${existingMetadata.title || '不明'}
- アーティストのスタイル: ${existingMetadata.artistStyle || '不明'}
- カテゴリ: ${existingMetadata.category || '不明'}
`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          },
          {
            type: 'text',
            text: `${contextHint}\n${ANALYSIS_PROMPT}`
          }
        ]
      }
    ]
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude Vision')
  }

  const jsonStr = content.text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(jsonStr) as ImageAnalysis
}

// Build searchable text from multiple sources including image analysis
export function buildMultimodalSearchText(params: {
  title: string
  description?: string
  tags?: string[]
  imageAnalysis: ImageAnalysis
}): string {
  const { title, description, tags, imageAnalysis } = params

  const parts = [
    `タイトル: ${title}`,
    description ? `説明: ${description}` : '',
    tags?.length ? `タグ: ${tags.join(', ')}` : '',

    // Image analysis data
    `視覚的特徴: ${imageAnalysis.visual.style}、${imageAnalysis.visual.technique}`,
    `色彩: ${imageAnalysis.visual.dominantColors.join('、')}（${imageAnalysis.visual.colorMood}）`,
    `主題: ${imageAnalysis.content.subject}`,
    `要素: ${imageAnalysis.content.elements.join('、')}`,
    `雰囲気: ${imageAnalysis.content.mood}`,
    `物語性: ${imageAnalysis.content.narrative}`,
    `推奨用途: ${imageAnalysis.meta.useCase.join('、')}`,

    // Natural language description for search
    imageAnalysis.searchableDescription
  ]

  return parts.filter(Boolean).join('\n')
}
