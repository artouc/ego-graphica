import { Bot } from "./bot"

/**
 * コマンドデプロイ専用スクリプト
 */
async function deploy() {
    console.log("🚀 スラッシュコマンドをデプロイしています...")

    try {
        const bot = new Bot()
        await bot.deployCommands()
        console.log("✅ デプロイが完了しました")
        process.exit(0)
    } catch (error) {
        console.error("❌ デプロイに失敗しました:", error)
        process.exit(1)
    }
}

deploy()

