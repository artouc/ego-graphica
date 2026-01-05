import type { MessageContent } from './chat'
import type { ImageAnalysis } from './work'

// Chat API
export interface ChatRequest {
  artistId: string
  messages: ChatMessage[]
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | MessageContent[]
}

export interface ChatResponse {
  success: boolean
  message?: string
}

// Work Upload API
export interface WorkUploadRequest {
  title: string
  titleEn?: string
  description?: string
  category?: string
  tags?: string[]
  styles?: string[]
  year?: number
  medium?: string
  isPublic?: boolean
  isFeatured?: boolean
}

export interface WorkUploadResponse {
  success: boolean
  workId: string
  imageAnalysis?: ImageAnalysis
  message?: string
}

// Artist API
export interface ArtistResponse {
  success: boolean
  artist?: {
    id: string
    name: string
    bio: string
    profileImageUrl?: string
    specialties: string[]
    styles: string[]
  }
}

// Health API
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    firebase: boolean
    pinecone: boolean
    anthropic: boolean
  }
  timestamp: string
}

// Error Response
export interface ErrorResponse {
  success: false
  error: string
  code?: string
}
