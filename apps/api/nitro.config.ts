import { defineNitroConfig } from "nitropack/config"
import { config } from "dotenv"

config()

export default defineNitroConfig({
    compatibilityDate: "2025-01-06",
    srcDir: ".",
    devServer: {
        port: 3011
    },
    runtimeConfig: {
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        xaiApiKey: process.env.XAI_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY,
        pineconeApiKey: process.env.PINECONE_API_KEY,
        pineconeIndex: process.env.PINECONE_INDEX,
        firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
        firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
        firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        webUrl: process.env.WEB_URL,
        masterApiKey: process.env.MASTER_API_KEY
    }
})
