/**
 * ego Graphica - Firebase Admin 初期化
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { getStorage, type Storage } from "firebase-admin/storage"
import { getAuth, type Auth } from "firebase-admin/auth"
import { LOG } from "@egographica/shared"

let firebase_app: App | null = null
let firestore_instance: Firestore | null = null
let storage_instance: Storage | null = null
let auth_instance: Auth | null = null

/** Firebase Admin を初期化 */
export function initializeFirebase(): App {
    if (firebase_app) {
        return firebase_app
    }

    const apps = getApps()
    if (apps.length > 0) {
        firebase_app = apps[0]
        return firebase_app
    }

    console.log(LOG.FIREBASE.INITIALIZING)

    const config = useRuntimeConfig()

    const private_key = Buffer.from(config.firebasePrivateKeyBase64 as string, "base64").toString("utf-8")

    firebase_app = initializeApp({
        credential: cert({
            projectId: config.firebaseProjectId,
            clientEmail: config.firebaseClientEmail,
            privateKey: private_key
        }),
        storageBucket: config.firebaseStorageBucket
    })

    console.log(LOG.FIREBASE.INITIALIZED)

    return firebase_app
}

/** Firestore インスタンスを取得 */
export function getFirestoreInstance(): Firestore {
    if (firestore_instance) {
        return firestore_instance
    }

    initializeFirebase()
    firestore_instance = getFirestore()
    console.log(LOG.FIREBASE.FIRESTORE_CONNECTED)

    return firestore_instance
}

/** Firebase Storage インスタンスを取得 */
export function getStorageInstance(): Storage {
    if (storage_instance) {
        return storage_instance
    }

    initializeFirebase()
    storage_instance = getStorage()
    console.log(LOG.FIREBASE.STORAGE_CONNECTED)

    return storage_instance
}

/** Firebase Auth インスタンスを取得 */
export function getAuthInstance(): Auth {
    if (auth_instance) {
        return auth_instance
    }

    initializeFirebase()
    auth_instance = getAuth()

    return auth_instance
}
