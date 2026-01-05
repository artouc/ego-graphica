export interface Artist {
  id: string
  createdAt: Date
  updatedAt: Date
  profile: ArtistProfile
  persona: ArtistPersona
  settings: AgentSettings
}

export interface ArtistProfile {
  name: string
  nameKana?: string
  email: string
  bio: string
  website?: string
  socialLinks: {
    twitter?: string
    instagram?: string
    behance?: string
  }
  profileImageUrl?: string
  coverImageUrl?: string
  activeYears: number
  specialties: string[]
  styles: string[]
}

export interface ArtistPersona {
  characterName?: string
  motif: string
  tone: PersonaTone
  personality: string[]
  artisticPhilosophy: string
  influences: string[]
  keywords: string[]
  greetingStyle: string
  sampleResponses: SampleResponse[]
  avoidTopics: string[]
  backstory: string
}

export type PersonaTone =
  | 'formal'
  | 'friendly'
  | 'artistic'
  | 'professional'
  | 'playful'

export interface SampleResponse {
  situation: string
  customerMessage: string
  idealResponse: string
}

export interface AgentSettings {
  isActive: boolean
  autoReply: boolean
  replyDelay?: number
  priceTable: PriceTable
  currency: 'JPY' | 'USD'
  availableDays: number[]
  busyPeriods: BusyPeriod[]
  leadTime: number
  notifyOnNewConversation: boolean
  notifyOnQuoteRequest: boolean
  notificationEmail?: string
}

export interface PriceTable {
  illustration: {
    small: number
    medium: number
    large: number
  }
  mural: {
    perSquareMeter: number
    minimumCharge: number
  }
  collaboration: {
    hourlyRate: number
    minimumHours: number
  }
  custom: Record<string, number>
}

export interface BusyPeriod {
  startDate: Date
  endDate: Date
  reason?: string
}
