import { defineEventHandler, readBody, setResponseHeaders } from 'h3'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { ChatRequestSchema } from '@egographica/shared'
import { searchRelevantContent, buildRAGContext } from '../utils/rag/search'
import { getArtistPersona, buildSystemPrompt, getDefaultPersonaContext } from '../utils/persona'
import { analyzeImage } from '../utils/ai/vision'
import { embedText } from '../utils/ai/embedding'

export default defineEventHandler(async (event) => {
  // Parse and validate request
  const body = await readBody(event)
  const { artistId, messages } = ChatRequestSchema.parse(body)

  // Set streaming headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  // Get last user message
  const lastMessage = messages.at(-1)
  const lastMessageText = typeof lastMessage?.content === 'string'
    ? lastMessage.content
    : lastMessage?.content?.find(c => c.type === 'text')?.text || ''

  // Check for image attachments
  let imageAnalysisContext = ''
  let enhancedQuery = lastMessageText

  if (hasImageAttachment(lastMessage)) {
    const imageUrl = extractImageUrl(lastMessage)
    if (imageUrl) {
      try {
        const analysis = await analyzeImage(imageUrl)
        imageAnalysisContext = `
## 顧客が添付した参考画像の分析

顧客が「こんな感じで」と添付した画像の特徴:
- スタイル: ${analysis.visual.style}
- 色彩: ${analysis.visual.dominantColors.join('、')}
- 雰囲気: ${analysis.content.mood}
- 主題: ${analysis.content.subject}
- 詳細: ${analysis.searchableDescription}

この特徴に近い作品を提案してください。
`
        enhancedQuery = `${analysis.searchableDescription} ${analysis.content.mood} ${analysis.visual.style}`
      } catch (error) {
        console.error('Image analysis failed:', error)
      }
    }
  }

  // Load persona and RAG context in parallel
  let personaContext
  let ragResults

  try {
    [personaContext, ragResults] = await Promise.all([
      getArtistPersona(artistId).catch(() => getDefaultPersonaContext(artistId)),
      searchRelevantContent(artistId, enhancedQuery, {
        topK: 5,
        minScore: 0.6
      }).catch(() => [])
    ])
  } catch (error) {
    console.error('Failed to load context:', error)
    personaContext = getDefaultPersonaContext(artistId)
    ragResults = []
  }

  // Build RAG context string
  const ragContext = buildRAGContext(ragResults)
  const fullContext = ragContext + (imageAnalysisContext ? '\n\n' + imageAnalysisContext : '')

  // Build system prompt with persona and RAG context
  const systemPrompt = buildSystemPrompt(personaContext, fullContext)

  // Convert messages for Claude
  const formattedMessages = messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: typeof msg.content === 'string'
      ? msg.content
      : msg.content.map((c) => {
          if (c.type === 'text') return { type: 'text' as const, text: c.text || '' }
          if (c.type === 'image' && c.source?.url) {
            return {
              type: 'image' as const,
              source: { type: 'url' as const, url: c.source.url }
            }
          }
          return { type: 'text' as const, text: '' }
        })
  }))

  // Stream response using Claude
  const result = streamText({
    model: anthropic('claude-opus-4-5-20250514'),
    system: systemPrompt,
    messages: formattedMessages,
    maxTokens: 4096,
    temperature: 0.7
  })

  return result.toDataStreamResponse()
})

function hasImageAttachment(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false
  const msg = message as { content?: unknown }
  if (Array.isArray(msg.content)) {
    return msg.content.some((c: unknown) => {
      if (typeof c === 'object' && c !== null) {
        return (c as { type?: string }).type === 'image'
      }
      return false
    })
  }
  return false
}

function extractImageUrl(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const msg = message as { content?: unknown[] }
  if (!Array.isArray(msg.content)) return null

  const imageContent = msg.content.find((c: unknown) => {
    if (typeof c === 'object' && c !== null) {
      return (c as { type?: string }).type === 'image'
    }
    return false
  }) as { source?: { url?: string }; image_url?: { url?: string } } | undefined

  return imageContent?.source?.url || imageContent?.image_url?.url || null
}
