import { Bot } from "./bot"

/**
 * エントリーポイント
 */
async function main() {
    console.log("🚀 ego Graphica Bot を起動しています...")

    const bot = new Bot()

    // シグナルハンドラーの設定
    const shutdown = async (signal: string) => {
        console.log(`\n⚠️  ${signal} を受信しました`)
        await bot.stop()
        process.exit(0)
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))

    // Bot の起動
    try {
        await bot.start()
    } catch (error) {
        console.error("❌ Bot の起動に失敗しました:", error)
        process.exit(1)
    }
}

// プロセスの未処理エラーをキャッチ
process.on("unhandledRejection", (error) => {
    console.error("❌ 未処理の Promise エラー:", error)
})

process.on("uncaughtException", (error) => {
    console.error("❌ 未処理の例外:", error)
    process.exit(1)
})

main()
