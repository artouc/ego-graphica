import { z } from 'zod'

export const PersonaToneSchema = z.enum([
  'formal',
  'friendly',
  'artistic',
  'professional',
  'playful'
])

export const SampleResponseSchema = z.object({
  situation: z.string().max(200),
  customerMessage: z.string().max(500),
  idealResponse: z.string().max(1000)
})

export const ArtistPersonaSchema = z.object({
  characterName: z.string().max(50).optional(),
  motif: z.string().min(1).max(50),
  tone: PersonaToneSchema,
  personality: z.array(z.string().max(30)).max(5),
  artisticPhilosophy: z.string().min(1).max(2000),
  influences: z.array(z.string().max(50)).max(10),
  keywords: z.array(z.string().max(30)).max(10),
  greetingStyle: z.string().max(500),
  sampleResponses: z.array(SampleResponseSchema).max(5),
  avoidTopics: z.array(z.string().max(50)).max(10),
  backstory: z.string().max(3000)
})

export const PriceTableSchema = z.object({
  illustration: z.object({
    small: z.number().min(0),
    medium: z.number().min(0),
    large: z.number().min(0)
  }),
  mural: z.object({
    perSquareMeter: z.number().min(0),
    minimumCharge: z.number().min(0)
  }),
  collaboration: z.object({
    hourlyRate: z.number().min(0),
    minimumHours: z.number().min(1)
  }),
  custom: z.record(z.string(), z.number().min(0)).optional()
})

export const AgentSettingsSchema = z.object({
  isActive: z.boolean().default(true),
  autoReply: z.boolean().default(true),
  replyDelay: z.number().min(0).max(60).optional(),
  priceTable: PriceTableSchema,
  currency: z.enum(['JPY', 'USD']).default('JPY'),
  availableDays: z.array(z.number().min(0).max(6)),
  leadTime: z.number().min(1).max(365).default(14),
  notifyOnNewConversation: z.boolean().default(true),
  notifyOnQuoteRequest: z.boolean().default(true),
  notificationEmail: z.string().email().optional()
})

export type ArtistPersonaInput = z.infer<typeof ArtistPersonaSchema>
export type AgentSettingsInput = z.infer<typeof AgentSettingsSchema>
