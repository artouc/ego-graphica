import { embedText } from '../ai/embedding'
import { searchSimilar, type SearchResult } from '../db/pinecone'

export interface RAGResult {
  type: 'work' | 'article' | 'podcast'
  sourceId: string
  title: string
  score: number
  snippet: string
  colors?: string[]
  style?: string
  mood?: string
}

export interface RAGSearchOptions {
  topK?: number
  types?: ('work' | 'article' | 'podcast')[]
  minScore?: number
}

// Search relevant content for RAG
export async function searchRelevantContent(
  artistId: string,
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGResult[]> {
  const { topK = 5, types, minScore = 0.7 } = options

  // Embed query text
  const queryEmbedding = await embedText(query)

  // Build filter
  const filter = types?.length
    ? { type: { $in: types } }
    : undefined

  // Execute search
  const results = await searchSimilar(artistId, queryEmbedding, {
    topK,
    filter
  })

  // Filter by score and format
  return results
    .filter(r => r.score >= minScore)
    .map(r => ({
      type: r.metadata!.type,
      sourceId: r.metadata!.sourceId,
      title: r.metadata!.title,
      score: r.score,
      snippet: r.metadata!.text.slice(0, 200) + '...',
      colors: r.metadata?.colors,
      style: r.metadata?.style,
      mood: r.metadata?.mood
    }))
}

// Build context string from RAG results
export function buildRAGContext(results: RAGResult[]): string {
  if (results.length === 0) {
    return ''
  }

  const contextParts = results.map((r, i) => {
    const visualInfo = [
      r.colors?.length ? `色彩: ${r.colors.join('、')}` : '',
      r.style ? `スタイル: ${r.style}` : '',
      r.mood ? `雰囲気: ${r.mood}` : ''
    ].filter(Boolean).join(' | ')

    return `[${i + 1}] ${r.title} (${r.type})
${r.snippet}
${visualInfo}`
  })

  return `## 関連コンテンツ

${contextParts.join('\n\n')}`
}

// Visual search options
export interface VisualSearchOptions {
  query?: string
  colors?: string[]
  style?: string
  mood?: string
  topK?: number
}

// Visual search for works
export async function visualSearch(
  artistId: string,
  options: VisualSearchOptions
): Promise<SearchResult[]> {
  const { query, colors, style, mood, topK = 5 } = options

  // Build search query
  const searchParts = [query]

  if (colors?.length) {
    searchParts.push(`色: ${colors.join('、')}`)
  }
  if (style) {
    searchParts.push(`スタイル: ${style}`)
  }
  if (mood) {
    searchParts.push(`雰囲気: ${mood}`)
  }

  const searchQuery = searchParts.filter(Boolean).join(' ')
  const queryEmbedding = await embedText(searchQuery)

  // Build Pinecone metadata filter
  const filter: Record<string, unknown> = { type: { $eq: 'work' } }

  if (colors?.length) {
    filter.colors = { $in: colors }
  }
  if (style) {
    filter.style = { $eq: style }
  }
  if (mood) {
    filter.mood = { $eq: mood }
  }

  const results = await searchSimilar(artistId, queryEmbedding, {
    topK,
    filter
  })

  return results
}
