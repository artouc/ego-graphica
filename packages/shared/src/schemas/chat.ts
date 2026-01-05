import { z } from 'zod'

export const MessageContentSchema = z.object({
  type: z.enum(['text', 'image']),
  text: z.string().optional(),
  source: z.object({
    type: z.enum(['url', 'base64']),
    url: z.string().optional(),
    media_type: z.string().optional(),
    data: z.string().optional()
  }).optional()
})

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([
    z.string(),
    z.array(MessageContentSchema)
  ])
})

export const ChatRequestSchema = z.object({
  artistId: z.string().min(1),
  messages: z.array(ChatMessageSchema)
})

export type ChatRequestInput = z.infer<typeof ChatRequestSchema>
