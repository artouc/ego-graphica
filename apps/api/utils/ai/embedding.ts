import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const config = useRuntimeConfig()

    if (!config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    openaiClient = new OpenAI({
      apiKey: config.openaiApiKey
    })
  }
  return openaiClient
}

// Embed single text
export async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAI()

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 3072
  })

  return response.data[0].embedding
}

// Embed multiple texts in batch
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI()

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: texts,
    dimensions: 3072
  })

  return response.data.map(d => d.embedding)
}

// Prepare searchable text from various inputs
export function prepareSearchableText(params: {
  title: string
  description?: string
  tags?: string[]
  content?: string
  imageDescription?: string
}): string {
  const parts = [
    params.title,
    params.description,
    params.tags?.join(' '),
    params.content,
    params.imageDescription
  ].filter(Boolean)

  // Limit to 8000 characters (embedding model limit is 8191 tokens)
  return parts.join('\n\n').slice(0, 8000)
}
