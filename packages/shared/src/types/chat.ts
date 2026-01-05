export interface Conversation {
  id: string
  artistId: string
  createdAt: Date
  updatedAt: Date
  customer: {
    name?: string
    email?: string
    company?: string
  }
  status: ConversationStatus
  summary?: string
  tags: string[]
  messageCount: number
  lastMessageAt: Date
}

export type ConversationStatus =
  | 'active'
  | 'waiting_response'
  | 'quote_sent'
  | 'closed'
  | 'converted'

export interface Message {
  id: string
  conversationId: string
  createdAt: Date
  role: 'user' | 'assistant' | 'system'
  content: string | MessageContent[]
  toolCalls?: ToolCallResult[]
  tokensUsed?: number
  modelUsed?: string
}

export interface MessageContent {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: 'url' | 'base64'
    url?: string
    media_type?: string
    data?: string
  }
}

export interface ToolCallResult {
  toolName: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  displayComponent?: string
}

export interface Quote {
  id: string
  artistId: string
  conversationId: string
  createdAt: Date
  updatedAt: Date
  customer: {
    name: string
    email: string
    company?: string
  }
  items: QuoteItem[]
  subtotal: number
  tax: number
  total: number
  currency: 'JPY' | 'USD'
  validUntil: Date
  deliveryDate?: Date
  notes?: string
  status: QuoteStatus
  sentAt?: Date
  respondedAt?: Date
}

export interface QuoteItem {
  description: string
  category: string
  quantity: number
  unitPrice: number
  amount: number
}

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
