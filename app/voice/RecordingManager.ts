import {
    joinVoiceChannel,
    VoiceConnection,
    EndBehaviorType,
    VoiceConnectionStatus,
    entersState,
    DiscordGatewayAdapterCreator
} from "@discordjs/voice"
import type { VoiceBasedChannel } from "discord.js"
import * as prism from "prism-media"
import fs from "fs"
import path from "path"
import { appConfig, RECORDINGS_DIR } from "../env"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const wav_writer = require("wav").Writer

interface Participant {
    user_id: string
    username: string
    display_name: string
    joined_at: number
}

interface Segment {
    user_id: string
    start_ms: number
    end_ms?: number
    file: string
    duration?: number
}

interface UserRecordingState {
    decoder: prism.opus.Decoder
    writer: typeof wav_writer
    file_stream: fs.WriteStream
    file_name: string
    start_time: number
    last_audio_time: number
    silence_timer?: NodeJS.Timeout
}

/**
 * RecordingManager
 * ギルドごとに1つ作成され、ボイスチャンネルの録音を管理する
 */
export class RecordingManager {
    private connection: VoiceConnection | null = null
    private session_dir: string = ""
    private participants = new Map<string, Participant>()
    private segments: Segment[] = []
    private user_states = new Map<string, UserRecordingState>()
    private start_time: number = 0
    private is_recording: boolean = false

    constructor(
        private guild_id: string,
        private channel: VoiceBasedChannel
    ) {}

    /**
     * 録音を開始
     */
    async start(): Promise<string> {
        if (this.is_recording) {
            throw new Error("すでに録音が開始されています")
        }

        // セッションディレクトリの作成
        const timestamp = Date.now()
        this.session_dir = path.join(RECORDINGS_DIR, `${timestamp}_${this.guild_id}`)

        try {
            fs.mkdirSync(this.session_dir, { recursive: true })
        } catch (error) {
            console.error("セッションディレクトリの作成に失敗:", error)
            // フォールバック: /tmp に作成
            this.session_dir = path.join(
                "/tmp",
                "egographica-recordings",
                `${timestamp}_${this.guild_id}`
            )
            fs.mkdirSync(this.session_dir, { recursive: true })
        }

        this.start_time = timestamp
        this.is_recording = true

        console.log(
            `🔌 ボイスチャンネルに接続中... (Channel: ${this.channel.id}, Guild: ${this.guild_id})`
        )

        // ボイスチャンネルに接続
        this.connection = joinVoiceChannel({
            channelId: this.channel.id,
            guildId: this.guild_id,
            adapterCreator: this.channel.guild
                .voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
            selfDeaf: false,
            selfMute: true
        })

        // 接続状態の監視
        this.connection.on("stateChange", (old_state, new_state) => {
            console.log(
                `🔌 接続状態変更: ${old_state.status} → ${new_state.status} (${new_state.status})`
            )
        })

        this.connection.on("error", (error) => {
            console.error("❌ ボイス接続エラー:", error)
        })

        try {
            console.log("⏳ Ready状態を待機中...")
            await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000)
            console.log("✅ ボイスチャンネルに接続しました")
        } catch (error) {
            const error_message = error instanceof Error ? error.message : String(error)
            console.error("❌ 接続タイムアウト:", error_message)
            console.error("接続状態:", this.connection.state.status)

            if (this.connection) {
                this.connection.destroy()
            }

            throw new Error(
                `ボイスチャンネルへの接続がタイムアウトしました。\n` +
                    `エラー: ${error_message}\n` +
                    `状態: ${this.connection?.state.status || "不明"}\n\n` +
                    `確認事項:\n` +
                    `1. Botに「接続」「発言」「音声検出を使用」の権限があるか\n` +
                    `2. Botがサーバーに正しく招待されているか\n` +
                    `3. ボイスチャンネルが利用可能か\n` +
                    `4. Botが他のボイスチャンネルに接続していないか`
            )
        }

        // 音声受信の開始
        this.setupAudioReceiving()

        console.log(`🎙️ 録音開始: ${this.session_dir}`)
        return this.session_dir
    }

    /**
     * 音声受信のセットアップ
     */
    private setupAudioReceiving() {
        if (!this.connection) return

        const receiver = this.connection.receiver

        // ユーザーごとの音声ストリームを監視
        receiver.speaking.on("start", (user_id) => {
            this.handleSpeakingStart(user_id)
        })
    }

    /**
     * ユーザーが話し始めたときの処理
     */
    private handleSpeakingStart(user_id: string) {
        if (!this.connection || !this.is_recording) return

        // 既に録音中の場合はスキップ
        if (this.user_states.has(user_id)) return

        const receiver = this.connection.receiver
        const audio_stream = receiver.subscribe(user_id, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: appConfig.recording.afterSilenceMs
            }
        })

        // ユーザー情報の取得と保存
        this.addParticipant(user_id)

        // Opus デコーダーの作成
        const decoder = new prism.opus.Decoder({
            rate: 48000,
            channels: 2,
            frameSize: 960
        })

        // WAV ライターの作成
        const start_time = Date.now()
        const file_name = `${user_id}_${start_time}.wav`
        const file_path = path.join(this.session_dir, file_name)
        const file_stream = fs.createWriteStream(file_path)

        const writer = new wav_writer({
            sampleRate: 48000,
            channels: 2,
            bitDepth: 16
        })

        writer.pipe(file_stream)

        // ユーザーの録音状態を保存
        this.user_states.set(user_id, {
            decoder,
            writer,
            file_stream,
            file_name,
            start_time,
            last_audio_time: Date.now()
        })

        // セグメント情報を記録
        const segment: Segment = {
            user_id,
            start_ms: start_time - this.start_time,
            file: file_name
        }
        this.segments.push(segment)

        // 音声データの処理
        audio_stream.pipe(decoder).pipe(writer)

        // ストリーム終了時の処理
        audio_stream.on("end", () => {
            this.finalizeSegment(user_id, segment)
        })

        // エラーハンドリング
        audio_stream.on("error", (error) => {
            console.error(`音声ストリームエラー (${user_id}):`, error)
            this.finalizeSegment(user_id, segment)
        })
    }

    /**
     * セグメントの終了処理
     */
    private finalizeSegment(user_id: string, segment: Segment) {
        const state = this.user_states.get(user_id)
        if (!state) return

        try {
            state.writer.end()
            state.file_stream.end()

            const end_time = Date.now()
            segment.end_ms = end_time - this.start_time
            segment.duration = end_time - state.start_time

            console.log(`✅ セグメント終了: ${segment.file} (${segment.duration}ms)`)
        } catch (error) {
            console.error(`セグメント終了エラー (${user_id}):`, error)
        } finally {
            this.user_states.delete(user_id)
        }
    }

    /**
     * 参加者情報を追加
     */
    private addParticipant(user_id: string) {
        if (this.participants.has(user_id)) return

        const member = this.channel.guild.members.cache.get(user_id)
        if (!member) return

        const participant: Participant = {
            user_id,
            username: member.user.username,
            display_name: member.displayName,
            joined_at: Date.now()
        }

        this.participants.set(user_id, participant)
        console.log(`👤 参加者追加: ${participant.display_name} (${participant.username})`)
    }

    /**
     * 録音を停止
     */
    async stop(): Promise<RecordingSummary> {
        if (!this.is_recording) {
            throw new Error("録音が開始されていません")
        }

        this.is_recording = false

        // すべてのユーザーの録音を終了
        for (const [user_id, state] of this.user_states.entries()) {
            try {
                state.writer.end()
                state.file_stream.end()
            } catch (error) {
                console.error(`録音終了エラー (${user_id}):`, error)
            }
        }
        this.user_states.clear()

        // メタデータの保存
        await this.saveMetadata()

        // ボイスチャンネルから切断
        if (this.connection) {
            this.connection.destroy()
            this.connection = null
        }

        const end_time = Date.now()
        const duration = end_time - this.start_time

        console.log(`⏹️ 録音停止: ${this.session_dir} (${duration}ms)`)

        return {
            directory: this.session_dir,
            duration,
            participant_count: this.participants.size,
            segment_count: this.segments.length
        }
    }

    /**
     * メタデータの保存
     */
    private async saveMetadata() {
        try {
            // participants.json
            const participants_data = Object.fromEntries(
                Array.from(this.participants.entries()).map(([user_id, p]) => [
                    user_id,
                    {
                        username: p.username,
                        display_name: p.display_name,
                        joined_at: p.joined_at
                    }
                ])
            )

            const participants_path = path.join(this.session_dir, "participants.json")
            fs.writeFileSync(participants_path, JSON.stringify(participants_data, null, 2))

            // segments.jsonl
            const segments_path = path.join(this.session_dir, "segments.jsonl")
            const segments_content = this.segments.map((seg) => JSON.stringify(seg)).join("\n")
            fs.writeFileSync(segments_path, segments_content)

            console.log("💾 メタデータを保存しました")
        } catch (error) {
            console.error("メタデータの保存に失敗:", error)
        }
    }

    /**
     * 録音中かどうか
     */
    isActive(): boolean {
        return this.is_recording
    }

    /**
     * セッション情報の取得
     */
    getSessionInfo() {
        return {
            session_dir: this.session_dir,
            start_time: this.start_time,
            participant_count: this.participants.size,
            segment_count: this.segments.length,
            is_recording: this.is_recording
        }
    }
}

export interface RecordingSummary {
    directory: string
    duration: number
    participant_count: number
    segment_count: number
}
