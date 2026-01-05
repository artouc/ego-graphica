export interface Work {
  id: string
  artistId: string
  createdAt: Date
  updatedAt: Date
  title: string
  titleEn?: string
  description: string
  descriptionEn?: string
  category: WorkCategory
  tags: string[]
  styles: string[]
  images: WorkImage[]
  videoUrl?: string
  year: number
  medium: string
  dimensions?: {
    width: number
    height: number
    unit: 'cm' | 'inch' | 'px'
  }
  isForSale: boolean
  price?: number
  isCommissionable: boolean
  isPublic: boolean
  isFeatured: boolean
  imageAnalysis?: ImageAnalysis
  searchableText: string
}

export type WorkCategory =
  | 'illustration'
  | 'painting'
  | 'mural'
  | 'graphic_design'
  | 'character_design'
  | 'concept_art'
  | 'photography'
  | 'other'

export interface WorkImage {
  url: string
  thumbnailUrl: string
  alt: string
  isPrimary: boolean
  order: number
}

export interface ImageAnalysis {
  visual: {
    dominantColors: string[]
    colorMood: string
    composition: string
    style: string
    technique: string
  }
  content: {
    subject: string
    elements: string[]
    mood: string
    narrative: string
  }
  meta: {
    suggestedTags: string[]
    similarStyles: string[]
    targetAudience: string
    useCase: string[]
  }
  searchableDescription: string
}
