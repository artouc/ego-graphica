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
import { StorageService } from "./services/storageService"
import { TranscriptionService } from "./services/transcriptionService"

/**
 * Bot クラス
 * Discord Bot のコアロジックを管理
 */
export class Bot {
    private client: Client
    private recording_managers = new Map<string, RecordingManager>()
    private storage_service: StorageService
    private transcription_service: TranscriptionService

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        })

        this.storage_service = new StorageService()
        this.transcription_service = new TranscriptionService()
        this.setupEventHandlers()
    }

    /**
     * イベントハンドラーのセットアップ
     */
    private setupEventHandlers() {
        // discord.js v15対応: clientReadyを使用
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
            // 録音を停止
            const summary = await manager.stop()
            this.recording_managers.delete(interaction.guildId)

            const duration_str = this.formatDuration(summary.duration)

            // 録音停止メッセージ
            await interaction.editReply({
                content:
                    messages.recording.stopped(duration_str, summary.participant_count) +
                    "\n" +
                    messages.recording.filesSaved(summary.directory)
            })

            console.log(`⏹️ 録音停止: Guild ${interaction.guildId}`)

            // Firebase Storage が設定されていない場合は終了
            if (!this.storage_service.isConfigured()) {
                await interaction.followUp({
                    content: messages.upload.firebaseNotConfigured,
                    ephemeral: true
                })
                return
            }

            // アップロード開始メッセージ
            const upload_message = await interaction.followUp({
                content: messages.upload.starting
            })

            try {
                // WAV → MP3 変換
                await upload_message.edit({
                    content: messages.upload.converting
                })

                const mp3_paths = await this.storage_service.convertAllToMp3(
                    summary.directory,
                    (current, total) => {
                        upload_message
                            .edit({
                                content: messages.upload.convertingProgress(current, total)
                            })
                            .catch(() => {
                                // メッセージ編集エラーは無視
                            })
                    }
                )

                console.log(`✅ ${mp3_paths.length} ファイルをMP3に変換しました`)

                // 文字起こし
                let transcription_result = null
                if (this.transcription_service.isConfigured()) {
                    try {
                        await upload_message.edit({
                            content: messages.transcription.starting
                        })

                        transcription_result = await this.transcription_service.transcribeRecording(
                            summary.directory,
                            (current, total) => {
                                upload_message
                                    .edit({
                                        content: messages.transcription.processing(current, total)
                                    })
                                    .catch(() => {
                                        // メッセージ編集エラーは無視
                                    })
                            }
                        )

                        const transcription_duration = this.transcription_service.formatDuration(
                            transcription_result.duration_ms
                        )

                        console.log(
                            `✅ 文字起こし完了: ${transcription_result.character_count} 文字 (${transcription_duration})`
                        )
                    } catch (transcription_error) {
                        console.error("文字起こしエラー:", transcription_error)
                        const error_msg =
                            transcription_error instanceof Error
                                ? transcription_error.message
                                : "不明なエラー"
                        await interaction.followUp({
                            content: messages.transcription.failed(error_msg),
                            ephemeral: true
                        })
                        // エラーがあってもアップロードは続行
                    }
                } else {
                    await interaction.followUp({
                        content: messages.transcription.notConfigured,
                        ephemeral: true
                    })
                }

                // Firebase Storageにアップロード
                await upload_message.edit({
                    content: messages.upload.uploading
                })

                const upload_result = await this.storage_service.uploadRecording(
                    summary.directory,
                    (current, total, percent) => {
                        upload_message
                            .edit({
                                content: messages.upload.uploadingProgress(current, total, percent)
                            })
                            .catch(() => {
                                // メッセージ編集エラーは無視
                            })
                    }
                )

                // アップロード完了メッセージ
                const upload_duration = this.storage_service.formatDuration(
                    upload_result.duration_ms
                )
                const total_size = this.storage_service.formatBytes(upload_result.total_size)
                const file_count = upload_result.audio_files.length

                let completion_message =
                    messages.upload.completed(upload_duration, file_count, total_size) +
                    "\n\n" +
                    messages.upload.downloadLinks +
                    "\n"

                // 音声ファイルのリンク
                if (upload_result.audio_files.length > 0) {
                    completion_message += `\n**${messages.upload.audioFiles}**\n`
                    for (const file of upload_result.audio_files.slice(0, 10)) {
                        // 最大10個まで
                        completion_message += `• [${file.name}](${file.url})\n`
                    }
                    if (upload_result.audio_files.length > 10) {
                        completion_message += `...他 ${upload_result.audio_files.length - 10} ファイル\n`
                    }
                }

                // メタデータのリンク
                if (upload_result.metadata_files.length > 0) {
                    completion_message += `\n**${messages.upload.metadata}**\n`
                    for (const file of upload_result.metadata_files) {
                        completion_message += `• [${file.name}](${file.url})\n`
                    }
                }

                completion_message += `\n${messages.upload.linksExpire(7)}`

                // 文字起こしプレビューを追加
                if (transcription_result && transcription_result.transcript) {
                    const preview =
                        transcription_result.transcript.length > 500
                            ? transcription_result.transcript.substring(0, 500) + "..."
                            : transcription_result.transcript

                    completion_message += `\n\n${messages.transcription.preview}\n\`\`\`\n${preview}\n\`\`\``
                }

                await upload_message.edit({
                    content: completion_message
                })

                console.log(`✅ アップロード完了: ${file_count} ファイル (${total_size})`)
            } catch (upload_error) {
                console.error("アップロードエラー:", upload_error)
                const error_msg =
                    upload_error instanceof Error ? upload_error.message : "不明なエラー"

                await upload_message.edit({
                    content: messages.upload.failed(error_msg)
                })
            }
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
