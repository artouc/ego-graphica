import { Bot } from "./bot"
import { messages } from "./messages"

/**
 * コマンドデプロイ専用スクリプト
 */
async function deploy() {
    console.log(messages.deploy.starting)

    try {
        const bot = new Bot()
        await bot.deployCommands()
        console.log(messages.deploy.completed)
        process.exit(0)
    } catch (error) {
        const error_message = error instanceof Error ? error.message : messages.errors.unknownError
        console.error(messages.deploy.failed(error_message))
        process.exit(1)
    }
}

deploy()

