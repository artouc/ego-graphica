import OpenAI from "openai"
import fs from "fs"
import path from "path"
import { appConfig } from "../env"
import { messages } from "../messages"

interface Segment {
    user_id: string
    start_ms: number
    end_ms?: number
    file: string
    duration?: number
}

interface Participant {
    username: string
    display_name: string
    joined_at: number
}

interface TranscriptionResult {
    transcript: string
    character_count: number
    duration_ms: number
}

interface TranscriptionSegment {
    speaker: string
    text: string
    timestamp: string
}

/**
 * TranscriptionService
 * 録音された音声ファイルをGPT-4o-miniで文字起こし
 */
export class TranscriptionService {
    private openai: OpenAI | null = null
    private is_initialized: boolean = false

    constructor() {
        this.initialize()
    }

    /**
     * OpenAI クライアントの初期化
     */
    private initialize() {
        const { apiKey: api_key, transcriptionEnabled: transcription_enabled } = appConfig.openai

        if (!transcription_enabled) {
            console.log("ℹ️ 文字起こし機能は無効化されています")
            return
        }

        if (!api_key) {
            console.warn("⚠️ OpenAI API Key が設定されていません。文字起こし機能は無効化されます。")
            return
        }

        try {
            this.openai = new OpenAI({
                apiKey: api_key
            })
            this.is_initialized = true
            console.log("✅ OpenAI クライアントを初期化しました")
        } catch (error) {
            console.error("❌ OpenAI クライアントの初期化に失敗:", error)
        }
    }

    /**
     * 初期化されているかチェック
     */
    isConfigured(): boolean {
        return this.is_initialized
    }

    /**
     * タイムスタンプをフォーマット（mm:ss）
     */
    private formatTimestamp(ms: number): string {
        const total_seconds = Math.floor(ms / 1000)
        const minutes = Math.floor(total_seconds / 60)
        const seconds = total_seconds % 60
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }

    /**
     * 音声ファイルを文字起こし
     */
    private async transcribeAudio(audio_path: string): Promise<string> {
        if (!this.openai) {
            throw new Error("OpenAI クライアントが初期化されていません")
        }

        const file_stream = fs.createReadStream(audio_path)

        const response = await this.openai.audio.transcriptions.create({
            file: file_stream,
            model: "whisper-1",
            language: "ja",
            response_format: "text"
        })

        return response as string
    }

    /**
     * 録音セッションを文字起こし
     */
    async transcribeRecording(
        session_dir: string,
        progress_callback?: (current: number, total: number) => void
    ): Promise<TranscriptionResult> {
        if (!this.is_initialized || !this.openai) {
            throw new Error(messages.transcription.notConfigured)
        }

        const start_time = Date.now()

        // segments.jsonl を読み込み
        const segments_path = path.join(session_dir, "segments.jsonl")
        if (!fs.existsSync(segments_path)) {
            throw new Error("segments.jsonl が見つかりません")
        }

        const segments_content = fs.readFileSync(segments_path, "utf-8")
        const segments: Segment[] = segments_content
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))

        // participants.json を読み込み
        const participants_path = path.join(session_dir, "participants.json")
        if (!fs.existsSync(participants_path)) {
            throw new Error("participants.json が見つかりません")
        }

        const participants_data = JSON.parse(fs.readFileSync(participants_path, "utf-8"))
        const participants: Record<string, Participant> = participants_data

        // 各音声ファイルを文字起こし
        const transcriptions: TranscriptionSegment[] = []
        let processed = 0

        for (const segment of segments) {
            const audio_path = path.join(session_dir, segment.file)

            // WAVファイルがあるか確認（MP3変換前の場合）
            const mp3_path = audio_path.replace(".wav", ".mp3")
            const file_to_transcribe = fs.existsSync(mp3_path) ? mp3_path : audio_path

            if (!fs.existsSync(file_to_transcribe)) {
                console.warn(`⚠️ ファイルが見つかりません: ${file_to_transcribe}`)
                continue
            }

            try {
                const text = await this.transcribeAudio(file_to_transcribe)

                if (text.trim()) {
                    const participant = participants[segment.user_id]
                    const speaker = participant?.display_name || segment.user_id

                    transcriptions.push({
                        speaker,
                        text: text.trim(),
                        timestamp: this.formatTimestamp(segment.start_ms)
                    })
                }

                processed++
                if (progress_callback) {
                    progress_callback(processed, segments.length)
                }
            } catch (error) {
                console.error(`❌ 文字起こしエラー (${segment.file}):`, error)
                // エラーがあっても続行
            }
        }

        // 会話形式のテキストを生成
        const transcript = this.formatTranscript(transcriptions)

        // transcript.txt として保存
        const transcript_path = path.join(session_dir, "transcript.txt")
        fs.writeFileSync(transcript_path, transcript, "utf-8")

        const duration_ms = Date.now() - start_time

        return {
            transcript,
            character_count: transcript.length,
            duration_ms
        }
    }

    /**
     * 会話形式のテキストにフォーマット
     */
    private formatTranscript(transcriptions: TranscriptionSegment[]): string {
        if (transcriptions.length === 0) {
            return "（文字起こし結果なし）"
        }

        let transcript = "# 録音の文字起こし\n\n"
        transcript += `生成日時: ${new Date().toLocaleString("ja-JP", { timeZone: appConfig.timezone })}\n`
        transcript += `発話数: ${transcriptions.length}\n\n`
        transcript += "---\n\n"

        for (const seg of transcriptions) {
            transcript += `[${seg.timestamp}] **${seg.speaker}**\n${seg.text}\n\n`
        }

        return transcript
    }

    /**
     * ミリ秒を時間フォーマット
     */
    formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000)
        if (seconds < 60) {
            return `${seconds}秒`
        }
        const minutes = Math.floor(seconds / 60)
        const remaining_seconds = seconds % 60
        return `${minutes}分${remaining_seconds}秒`
    }
}
