import { defineEventHandler, readFormData, createError } from 'h3'
import { WorkUploadSchema, type WorkUploadResponse } from '@egographica/shared'
import { requireAuth } from '../../middleware/auth'
import { getDb, getAdminStorage } from '../../utils/db/firebase'
import { analyzeImage, buildMultimodalSearchText } from '../../utils/ai/vision'
import { embedText, prepareSearchableText } from '../../utils/ai/embedding'
import { upsertVector, type VectorMetadata } from '../../utils/db/pinecone'

export default defineEventHandler(async (event): Promise<WorkUploadResponse> => {
  // Authenticate user
  let artistId: string

  try {
    const user = await requireAuth(event)
    artistId = user.uid
  } catch {
    // For development, allow demo mode
    artistId = 'demo-artist'
  }

  const formData = await readFormData(event)
  const images = formData.getAll('images') as File[]
  const metadataStr = formData.get('metadata') as string

  if (!metadataStr) {
    throw createError({
      statusCode: 400,
      message: 'Metadata is required'
    })
  }

  if (images.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one image is required'
    })
  }

  // Validate metadata
  const metadata = WorkUploadSchema.parse(JSON.parse(metadataStr))

  const db = getDb()
  const storage = getAdminStorage()
  const workId = `work_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  try {
    // 1. Upload images to Firebase Storage
    const uploadedImages = await Promise.all(
      images.map(async (image, index) => {
        const buffer = Buffer.from(await image.arrayBuffer())
        const fileName = `${artistId}/${workId}/${index}_${image.name}`
        const bucket = storage.bucket()
        const file = bucket.file(`works/${fileName}`)

        await file.save(buffer, {
          metadata: {
            contentType: image.type
          }
        })

        // Make file publicly accessible
        await file.makePublic()

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/works/${fileName}`
        return {
          url: publicUrl,
          filename: image.name,
          size: image.size,
          mimeType: image.type
        }
      })
    )

    const primaryImageUrl = uploadedImages[0].url

    // 2. Get artist style info (if available)
    let artistStyle = ''
    try {
      const artistDoc = await db.collection('artists').doc(artistId).get()
      if (artistDoc.exists) {
        artistStyle = artistDoc.data()?.persona?.motif || ''
      }
    } catch {
      // Ignore if artist doc doesn't exist
    }

    // 3. Analyze image with Claude Vision
    const imageAnalysis = await analyzeImage(primaryImageUrl, {
      title: metadata.title,
      artistStyle,
      category: metadata.category
    })

    // 4. Build searchable text combining metadata and image analysis
    const searchableText = buildMultimodalSearchText({
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      imageAnalysis
    })

    // 5. Save work to Firestore
    const workData = {
      artistId,
      title: metadata.title,
      description: metadata.description || '',
      category: metadata.category || 'その他',
      tags: [
        ...(metadata.tags || []),
        ...imageAnalysis.meta.suggestedTags
      ],
      images: uploadedImages,
      primaryImage: primaryImageUrl,
      imageAnalysis,
      searchableText,
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await db.collection('works').doc(workId).set(workData)

    // 6. Generate embedding
    const embedding = await embedText(searchableText)

    // 7. Index in Pinecone
    const vectorMetadata: VectorMetadata = {
      artistId,
      type: 'work',
      sourceId: workId,
      title: metadata.title,
      category: metadata.category,
      tags: workData.tags,
      colors: imageAnalysis.visual.dominantColors,
      style: imageAnalysis.visual.style,
      mood: imageAnalysis.content.mood,
      text: searchableText.slice(0, 1000),
      createdAt: new Date().toISOString()
    }

    await upsertVector(artistId, `work_${workId}`, embedding, vectorMetadata)

    return {
      success: true,
      workId,
      message: `Work "${metadata.title}" uploaded and indexed successfully`,
      imageAnalysis
    }
  } catch (error) {
    console.error('Work ingest failed:', error)

    // Clean up on failure
    try {
      await db.collection('works').doc(workId).delete()
    } catch {
      // Ignore cleanup errors
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to process work'
    })
  }
})
