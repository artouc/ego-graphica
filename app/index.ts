import { Bot } from "./bot"
import { messages } from "./messages"

/**
 * エントリーポイント
 */
async function main() {
    console.log(messages.logs.botStarting)

    const bot = new Bot()

  // シグナルハンドラーの設定
  const shutdown = async (signal: string) => {
    console.log(messages.logs.signalReceived(signal))
    await bot.stop()
    process.exit(0)
  }

    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))

  // Bot の起動
  try {
    await bot.start()
  } catch (error) {
    const error_message = error instanceof Error ? error.message : messages.errors.unknownError
    console.error(messages.errors.botStartFailed(error_message))
    process.exit(1)
  }
}

// プロセスの未処理エラーをキャッチ
process.on("unhandledRejection", (error) => {
  const error_message = error instanceof Error ? error.message : String(error)
  console.error(messages.errors.unhandledRejection(error_message))
})

process.on("uncaughtException", (error) => {
  const error_message = error instanceof Error ? error.message : String(error)
  console.error(messages.errors.uncaughtException(error_message))
  process.exit(1)
})

main()
