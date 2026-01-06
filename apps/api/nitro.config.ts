import { defineNitroConfig } from "nitropack/config"

export default defineNitroConfig({
    compatibilityDate: "2025-01-06",
    srcDir: ".",
    routeRules: {
        "/api/**": {
            cors: true,
            headers: {
                "Access-Control-Allow-Origin": process.env.WEB_URL,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true"
            }
        }
    },
    runtimeConfig: {
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY,
        pineconeApiKey: process.env.PINECONE_API_KEY,
        pineconeIndex: process.env.PINECONE_INDEX,
        firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
        firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
        firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        webUrl: process.env.WEB_URL
    }
})
