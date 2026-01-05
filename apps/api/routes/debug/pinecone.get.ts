import { defineEventHandler } from 'h3'
import { getIndexStats } from '../../utils/db/pinecone'

export default defineEventHandler(async () => {
  try {
    const stats = await getIndexStats()
    return {
      success: true,
      stats
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
