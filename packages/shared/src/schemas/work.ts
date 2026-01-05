import { z } from 'zod'

export const WorkCategorySchema = z.enum([
  'illustration',
  'painting',
  'mural',
  'graphic_design',
  'character_design',
  'concept_art',
  'photography',
  'other'
])

export const WorkUploadSchema = z.object({
  title: z.string().min(1).max(100),
  titleEn: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  category: WorkCategorySchema.default('illustration'),
  tags: z.array(z.string().max(30)).max(20).optional(),
  styles: z.array(z.string().max(30)).max(10).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  medium: z.string().max(100).optional(),
  isPublic: z.boolean().default(true),
  isFeatured: z.boolean().default(false)
})

export type WorkUploadInput = z.infer<typeof WorkUploadSchema>
