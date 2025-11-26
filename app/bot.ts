import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    CommandInteraction,
    GuildMember,
    VoiceBasedChannel
} from "discord.js"
import { appConfig } from "./env"
import { messages } from "./messages"
import { RecordingManager } from "./voice/RecordingManager"

/**
 * Bot クラス
 * Discord Bot のコアロジックを管理
 */
export class Bot {
    private client: Client
    private recording_managers = new Map<string, RecordingManager>()

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        })

        this.setupEventHandlers()
    }

    /**
     * イベントハンドラーのセットアップ
     */
    private setupEventHandlers() {
        this.client.once("ready", () => {
            console.log(messages.bot.ready(this.client.user?.tag || "Bot"))
        })

        this.client.on("interactionCreate", async (interaction) => {
            if (!interaction.isChatInputCommand()) return
            await this.handleCommand(interaction)
        })
    }

    /**
     * コマンドハンドラー
     */
    private async handleCommand(interaction: CommandInteraction) {
        try {
            if (interaction.commandName !== "egographica") return
            if (!interaction.isChatInputCommand()) return

            const subcommand = interaction.options.getSubcommand()

            switch (subcommand) {
                case "record":
                    await this.handleRecordingStart(interaction)
                    break
                case "stop":
                    await this.handleRecordingStop(interaction)
                    break
                default:
                    await interaction.reply({
                        content: messages.commands.unknownError,
                        ephemeral: true
                    })
            }
        } catch (error) {
            console.error("コマンド実行エラー:", error)
            const error_message = error instanceof Error ? error.message : "不明なエラー"

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: messages.commands.error(error_message),
                    ephemeral: true
                })
            } else {
                await interaction.reply({
                    content: messages.commands.error(error_message),
                    ephemeral: true
                })
            }
        }
    }

    /**
     * 録音開始処理
     */
    private async handleRecordingStart(interaction: CommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: messages.commands.guildOnly,
                ephemeral: true
            })
            return
        }

        // ユーザーがボイスチャンネルにいるか確認
        const member = interaction.member as GuildMember
        const voice_channel = member?.voice?.channel

        if (!voice_channel) {
            await interaction.reply({
                content: messages.recording.notInVoiceChannel,
                ephemeral: true
            })
            return
        }

        // すでに録音中か確認
        const existing_manager = this.recording_managers.get(interaction.guildId)
        if (existing_manager?.isActive()) {
            await interaction.reply({
                content: messages.recording.alreadyRecording,
                ephemeral: true
            })
            return
        }

        // 録音開始
        await interaction.deferReply()

        try {
            const manager = new RecordingManager(
                interaction.guildId,
                voice_channel as VoiceBasedChannel
            )

            await manager.start()
            this.recording_managers.set(interaction.guildId, manager)

            await interaction.editReply({
                content: messages.recording.started(voice_channel.name)
            })

            console.log(`🎙️ 録音開始: Guild ${interaction.guildId}, Channel ${voice_channel.name}`)
        } catch (error) {
            console.error("録音開始エラー:", error)
            const error_message = error instanceof Error ? error.message : "不明なエラー"

            await interaction.editReply({
                content: messages.recording.recordingFailed(error_message)
            })
        }
    }

    /**
     * 録音停止処理
     */
    private async handleRecordingStop(interaction: CommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: messages.commands.guildOnly,
                ephemeral: true
            })
            return
        }

        const manager = this.recording_managers.get(interaction.guildId)
        if (!manager || !manager.isActive()) {
            await interaction.reply({
                content: messages.recording.notRecording,
                ephemeral: true
            })
            return
        }

        await interaction.deferReply()

        try {
            const summary = await manager.stop()
            this.recording_managers.delete(interaction.guildId)

            const duration_str = this.formatDuration(summary.duration)

            await interaction.editReply({
                content:
                    messages.recording.stopped(duration_str, summary.participant_count) +
                    "\n" +
                    messages.recording.filesSaved(summary.directory)
            })

            console.log(`⏹️ 録音停止: Guild ${interaction.guildId}`)
        } catch (error) {
            console.error("録音停止エラー:", error)
            const error_message = error instanceof Error ? error.message : "不明なエラー"

            await interaction.editReply({
                content: messages.recording.stopFailed(error_message)
            })
        }
    }

    /**
     * 時間のフォーマット（ミリ秒 → "mm:ss"）
     */
    private formatDuration(ms: number): string {
        const total_seconds = Math.floor(ms / 1000)
        const minutes = Math.floor(total_seconds / 60)
        const seconds = total_seconds % 60
        return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }

    /**
     * スラッシュコマンドの登録
     */
    private registerCommands() {
        return [
            new SlashCommandBuilder()
                .setName("egographica")
                .setDescription("ego Graphica Bot のコマンド")
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("record")
                        .setDescription("ボイスチャンネルの録音を開始します")
                )
                .addSubcommand((subcommand) =>
                    subcommand.setName("stop").setDescription("録音を停止します")
                )
                .toJSON()
        ]
    }

    /**
     * コマンドのデプロイ（Discord API に登録）
     */
    async deployCommands() {
        const commands = this.registerCommands()
        const rest = new REST({ version: "10" }).setToken(appConfig.discord.token)

        try {
            console.log("📝 スラッシュコマンドを登録しています...")

            if (appConfig.discord.guildId) {
                // ギルド固有のコマンドとして登録（即座に反映）
                await rest.put(
                    Routes.applicationGuildCommands(
                        appConfig.discord.clientId,
                        appConfig.discord.guildId
                    ),
                    { body: commands }
                )
                console.log(`✅ ギルド ${appConfig.discord.guildId} にコマンドを登録しました`)
            } else {
                // グローバルコマンドとして登録（反映まで最大1時間）
                await rest.put(Routes.applicationCommands(appConfig.discord.clientId), {
                    body: commands
                })
                console.log("✅ グローバルコマンドを登録しました")
            }
        } catch (error) {
            console.error("コマンド登録エラー:", error)
            throw error
        }
    }

    /**
     * Bot の起動
     */
    async start() {
        try {
            await this.client.login(appConfig.discord.token)
        } catch (error) {
            console.error("ログインエラー:", error)
            throw error
        }
    }

    /**
     * Bot の停止
     */
    async stop() {
        console.log(messages.bot.shutdownInitiated)

        // すべての録音を停止
        for (const [guild_id, manager] of this.recording_managers.entries()) {
            try {
                if (manager.isActive()) {
                    await manager.stop()
                    console.log(`⏹️ Guild ${guild_id} の録音を停止しました`)
                }
            } catch (error) {
                console.error(`録音停止エラー (Guild ${guild_id}):`, error)
            }
        }
        this.recording_managers.clear()

        // Discord クライアントの切断
        this.client.destroy()
        console.log(messages.bot.shutdownComplete)
    }
}
