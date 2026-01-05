import { defineEventHandler, getHeader, createError, type H3Event } from 'h3'
import { verifyIdToken } from '../utils/db/firebase'

export interface AuthenticatedUser {
  uid: string
  email?: string
}

// Middleware to require authentication
export async function requireAuth(event: H3Event): Promise<AuthenticatedUser> {
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      message: 'Authorization header required'
    })
  }

  const token = authHeader.slice(7)

  try {
    const user = await verifyIdToken(token)
    return user
  } catch (error) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired token'
    })
  }
}

// Optional authentication - returns null if not authenticated
export async function optionalAuth(event: H3Event): Promise<AuthenticatedUser | null> {
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)

  try {
    return await verifyIdToken(token)
  } catch {
    return null
  }
}
