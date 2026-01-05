import { defineEventHandler, getRouterParam, createError } from 'h3'
import type { ArtistResponse } from '@egographica/shared'

export default defineEventHandler(async (event): Promise<ArtistResponse> => {
  const artistId = getRouterParam(event, 'id')

  if (!artistId) {
    throw createError({
      statusCode: 400,
      message: 'Artist ID is required'
    })
  }

  // TODO: Fetch from Firestore
  // const db = getDb()
  // const artistDoc = await db.collection('artists').doc(artistId).get()

  // For now, return mock data
  return {
    success: true,
    artist: {
      id: artistId,
      name: 'サンプルアーティスト',
      bio: 'これはサンプルのアーティストプロフィールです。',
      profileImageUrl: undefined,
      specialties: ['イラスト', 'キャラクターデザイン'],
      styles: ['和風', 'ポップ']
    }
  }
})
