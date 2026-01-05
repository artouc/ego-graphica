import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getStorage, type Storage } from 'firebase-admin/storage'

let app: App | null = null
let db: Firestore | null = null
let auth: Auth | null = null
let storage: Storage | null = null

function initializeFirebaseAdmin(): App {
  if (app) return app

  const existingApps = getApps()
  if (existingApps.length > 0) {
    app = existingApps[0]
    return app
  }

  const config = useRuntimeConfig()

  if (!config.firebaseProjectId || !config.firebaseClientEmail || !config.firebasePrivateKey) {
    throw new Error('Firebase Admin credentials not configured')
  }

  app = initializeApp({
    credential: cert({
      projectId: config.firebaseProjectId,
      clientEmail: config.firebaseClientEmail,
      privateKey: config.firebasePrivateKey.replace(/\\n/g, '\n')
    }),
    storageBucket: `${config.firebaseProjectId}.appspot.com`
  })

  return app
}

export function getDb(): Firestore {
  if (!db) {
    initializeFirebaseAdmin()
    db = getFirestore()
  }
  return db
}

export function getAdminAuth(): Auth {
  if (!auth) {
    initializeFirebaseAdmin()
    auth = getAuth()
  }
  return auth
}

export function getAdminStorage(): Storage {
  if (!storage) {
    initializeFirebaseAdmin()
    storage = getStorage()
  }
  return storage
}

// Helper: Verify ID token from Authorization header
export async function verifyIdToken(token: string): Promise<{ uid: string; email?: string }> {
  const auth = getAdminAuth()
  const decodedToken = await auth.verifyIdToken(token)
  return {
    uid: decodedToken.uid,
    email: decodedToken.email
  }
}

// Helper: Create custom token for client auth
export async function createCustomToken(uid: string): Promise<string> {
  const auth = getAdminAuth()
  return auth.createCustomToken(uid)
}
