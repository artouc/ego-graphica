import { defineEventHandler } from 'h3'
import type { HealthResponse } from '@egographica/shared'

export default defineEventHandler(async (): Promise<HealthResponse> => {
  const config = useRuntimeConfig()

  const checks = {
    firebase: !!config.firebaseProjectId,
    pinecone: !!config.pineconeApiKey,
    anthropic: !!config.anthropicApiKey
  }

  const allHealthy = Object.values(checks).every(Boolean)

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }
})
