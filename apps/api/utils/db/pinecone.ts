import { Pinecone } from '@pinecone-database/pinecone'

let pineconeClient: Pinecone | null = null

export function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const config = useRuntimeConfig()

    if (!config.pineconeApiKey) {
      throw new Error('PINECONE_API_KEY is not configured')
    }

    pineconeClient = new Pinecone({
      apiKey: config.pineconeApiKey
    })
  }

  return pineconeClient
}

export function getIndex() {
  const config = useRuntimeConfig()
  return getPinecone().index(config.pineconeIndex || 'egographica')
}

// Vector metadata interface
export interface VectorMetadata {
  artistId: string
  type: 'work' | 'article' | 'podcast'
  sourceId: string
  title: string
  category?: string
  tags: string[]
  colors?: string[]
  style?: string
  mood?: string
  text: string
  createdAt: string
}

// Upsert single vector
export async function upsertVector(
  artistId: string,
  id: string,
  embedding: number[],
  metadata: VectorMetadata
): Promise<void> {
  const index = getIndex()

  await index.namespace(artistId).upsert([
    {
      id,
      values: embedding,
      metadata
    }
  ])
}

// Upsert multiple vectors in batch
export async function upsertVectorsBatch(
  artistId: string,
  vectors: Array<{
    id: string
    embedding: number[]
    metadata: VectorMetadata
  }>
): Promise<void> {
  const index = getIndex()
  const BATCH_SIZE = 100

  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE)

    await index.namespace(artistId).upsert(
      batch.map(v => ({
        id: v.id,
        values: v.embedding,
        metadata: v.metadata
      }))
    )
  }
}

// Delete single vector
export async function deleteVector(
  artistId: string,
  id: string
): Promise<void> {
  const index = getIndex()
  await index.namespace(artistId).deleteOne(id)
}

// Delete multiple vectors
export async function deleteVectors(
  artistId: string,
  ids: string[]
): Promise<void> {
  const index = getIndex()
  await index.namespace(artistId).deleteMany(ids)
}

// Delete entire namespace (all artist data)
export async function deleteNamespace(artistId: string): Promise<void> {
  const index = getIndex()
  await index.namespace(artistId).deleteAll()
}

// Search options
export interface SearchOptions {
  topK?: number
  filter?: Record<string, unknown>
  includeMetadata?: boolean
}

// Search result
export interface SearchResult {
  id: string
  score: number
  metadata?: VectorMetadata
}

// Search similar vectors
export async function searchSimilar(
  artistId: string,
  queryEmbedding: number[],
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = 5,
    filter,
    includeMetadata = true
  } = options

  const index = getIndex()

  const results = await index.namespace(artistId).query({
    vector: queryEmbedding,
    topK,
    filter,
    includeMetadata
  })

  return (results.matches || []).map(match => ({
    id: match.id,
    score: match.score || 0,
    metadata: match.metadata as VectorMetadata | undefined
  }))
}

// Search by type
export async function searchByType(
  artistId: string,
  queryEmbedding: number[],
  type: 'work' | 'article' | 'podcast',
  topK: number = 5
): Promise<SearchResult[]> {
  return searchSimilar(artistId, queryEmbedding, {
    topK,
    filter: { type: { $eq: type } }
  })
}

// Search by visual attributes
export async function searchByVisual(
  artistId: string,
  queryEmbedding: number[],
  options: {
    colors?: string[]
    style?: string
    mood?: string
    topK?: number
  }
): Promise<SearchResult[]> {
  const filter: Record<string, unknown> = { type: { $eq: 'work' } }

  if (options.colors?.length) {
    filter.colors = { $in: options.colors }
  }
  if (options.style) {
    filter.style = { $eq: options.style }
  }
  if (options.mood) {
    filter.mood = { $eq: options.mood }
  }

  return searchSimilar(artistId, queryEmbedding, {
    topK: options.topK || 5,
    filter
  })
}

// Index statistics
export interface IndexStats {
  totalVectorCount: number
  namespaces: Record<string, { vectorCount: number }>
}

export async function getIndexStats(): Promise<IndexStats> {
  const index = getIndex()
  const stats = await index.describeIndexStats()

  return {
    totalVectorCount: stats.totalRecordCount || 0,
    namespaces: stats.namespaces || {}
  }
}

// Get artist vector count
export async function getArtistVectorCount(artistId: string): Promise<number> {
  const stats = await getIndexStats()
  return stats.namespaces[artistId]?.vectorCount || 0
}
