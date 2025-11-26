import { z } from "zod"
import { config } from "dotenv"
import path from "path"
import fs from "fs"

// Load .env file
config()

// Environment variables schema
const envSchema = z.object({
    DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
    DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required for deployment"),
    DISCORD_GUILD_ID: z.string().optional(),

    DATA_DIR: z.string().default(path.join(process.cwd(), "var", "data")),
    TIMEZONE: z.string().default("Asia/Tokyo"),

    AFTER_SILENCE_MS: z.string().default("800"),
    RECORDING_SEGMENT_SECONDS: z.string().default("5"),

    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("3080")
})

// Parse and validate environment variables
function loadEnv() {
    const result = envSchema.safeParse(process.env)

    if (!result.success) {
        console.warn("⚠️  環境変数の検証に失敗しました:")
        result.error.issues.forEach((issue) => {
            console.warn(`  - ${issue.path.join(".")}: ${issue.message}`)
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
                console.log(`📁 ディレクトリを作成しました: ${dir}`)
            }
        } catch (error) {
            console.error(`❌ ディレクトリの作成に失敗しました: ${dir}`, error)
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
    recording: {
        afterSilenceMs: parseInt(env.AFTER_SILENCE_MS || "800", 10),
        segmentSeconds: parseInt(env.RECORDING_SEGMENT_SECONDS || "5", 10)
    },
    timezone: env.TIMEZONE || "Asia/Tokyo",
    nodeEnv: env.NODE_ENV || "development",
    port: parseInt(env.PORT || "3080", 10)
}
