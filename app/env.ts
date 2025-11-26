import { z } from "zod"
import { config } from "dotenv"
import path from "path"
import fs from "fs"
import { messages } from "./messages"

// Load .env file
config()

// Environment variables schema
const envSchema = z.object({
    DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
    DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required for deployment"),
    DISCORD_GUILD_ID: z.string().optional(),

    // Firebase Storage
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_STORAGE_BUCKET: z.string().optional(),

    // OpenAI
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    TRANSCRIPTION_ENABLED: z.string().default("true"),

    DATA_DIR: z.string().default(path.join(process.cwd(), "var", "data")),
    TIMEZONE: z.string().default("Asia/Tokyo"),

    AFTER_SILENCE_MS: z.string().default("800"),
    RECORDING_SEGMENT_SECONDS: z.string().default("5"),
    MP3_BITRATE: z.string().default("128"),

    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("3080")
})

// Parse and validate environment variables
function loadEnv() {
    const result = envSchema.safeParse(process.env)

    if (!result.success) {
        console.warn(messages.env.validationFailed)
        result.error.issues.forEach((issue) => {
            console.warn(messages.env.validationIssue(issue.path.join("."), issue.message))
        })
    }

    return result.success ? result.data : ({} as z.infer<typeof envSchema>)
}

export const env = loadEnv()

// Data directories
export const DATA_DIR = env.DATA_DIR || path.join(process.cwd(), "var", "data")
export const RECORDINGS_DIR = path.join(DATA_DIR, "recordings")

// Create necessary directories
function ensureDirectories() {
    const dirs = [DATA_DIR, RECORDINGS_DIR]

    for (const dir of dirs) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
                console.log(messages.env.directoryCreated(dir))
            }
        } catch (error) {
            const error_message = error instanceof Error ? error.message : String(error)
            console.error(messages.env.directoryCreationFailed(dir, error_message))
        }
    }
}

ensureDirectories()

// Parsed configuration values
export const appConfig = {
    discord: {
        token: env.DISCORD_BOT_TOKEN,
        clientId: env.DISCORD_CLIENT_ID,
        guildId: env.DISCORD_GUILD_ID
    },
    firebase: {
        projectId: env.FIREBASE_PROJECT_ID,
        privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        storageBucket: env.FIREBASE_STORAGE_BUCKET
    },
    openai: {
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        transcriptionEnabled: env.TRANSCRIPTION_ENABLED === "true"
    },
    recording: {
        afterSilenceMs: parseInt(env.AFTER_SILENCE_MS || "800", 10),
        segmentSeconds: parseInt(env.RECORDING_SEGMENT_SECONDS || "5", 10),
        mp3Bitrate: parseInt(env.MP3_BITRATE || "128", 10)
    },
    timezone: env.TIMEZONE || "Asia/Tokyo",
    nodeEnv: env.NODE_ENV || "development",
    port: parseInt(env.PORT || "3080", 10)
}
