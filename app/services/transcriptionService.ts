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
            console.log(messages.env.transcriptionDisabled)
            return
        }

        if (!api_key) {
            console.warn(messages.env.openaiKeyMissing)
            return
        }

        try {
            this.openai = new OpenAI({
                apiKey: api_key
            })
            this.is_initialized = true
            console.log(messages.env.openaiInitialized)
        } catch (error) {
            const error_message = error instanceof Error ? error.message : String(error)
            console.error(messages.env.openaiInitFailed(error_message))
        }
    }

    /**
     * 初期化されているかチェック
     */
    isConfigured(): boolean {
        return this.is_initialized
    }

    /**
     * ノイズとフィラーをフィルタリング
     * 短いフィラーは削除し、長い発声（「あーあーあー」など）は残す
     */
    private filterNoise(text: string): string {
        // 短いフィラーパターン（1-2文字の「えー」「あー」など）
        const short_fillers = [
            /^えー$/,
            /^あー$/,
            /^うー$/,
            /^んー$/,
            /^え$/,
            /^あ$/,
            /^う$/,
            /^ん$/
        ]

        // 文を分割して処理
        const sentences = text.split(/[。、\n]/).filter((s) => s.trim())

        const filtered_sentences = sentences.filter((sentence) => {
            const trimmed = sentence.trim()

            // 短いフィラーのみの文は削除
            for (const pattern of short_fillers) {
                if (pattern.test(trimmed)) {
                    return false
                }
            }

            // 3文字以上の「あーあーあー」のような長い発声は残す
            if (trimmed.length >= 3) {
                return true
            }

            // その他の短い文は内容を確認
            // 意味のある単語が含まれている場合は残す
            const meaningful_patterns = [
                /[あ-ん]{2,}/, // 2文字以上のひらがな
                /[ア-ン]{2,}/, // 2文字以上のカタカナ
                /[一-龯]/, // 漢字
                /[a-zA-Z]{2,}/ // 2文字以上のアルファベット
            ]

            return meaningful_patterns.some((pattern) => pattern.test(trimmed))
        })

        return filtered_sentences.join("。").trim()
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
            throw new Error(messages.errors.openaiNotInitialized)
        }

        const file_stream = fs.createReadStream(audio_path)

        // 文字起こしプロンプト（ノイズ処理と品質向上）
        const prompt = `これは日本語の会話の音声です。以下のルールに従って文字起こししてください：

- 短いフィラー（「えー」「あー」「うーん」など）は無視してください
- 背景ノイズや無意味な音は文字起こししないでください
- ただし、「あーあーあー」のように長く続く発声は、そのまま文字起こししてください
- 会話の内容を正確に文字起こししてください
- 句読点は適切に使用してください
- 話し言葉の特徴（「ですよね」「みたいな」など）はそのまま残してください`

        const response = await this.openai.audio.transcriptions.create({
            file: file_stream,
            model: "whisper-1",
            language: "ja",
            response_format: "text",
            prompt: prompt
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
            throw new Error(messages.errors.segmentsNotFound)
        }

        const segments_content = fs.readFileSync(segments_path, "utf-8")
        const segments: Segment[] = segments_content
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))

        // participants.json を読み込み
        const participants_path = path.join(session_dir, "participants.json")
        if (!fs.existsSync(participants_path)) {
            throw new Error(messages.errors.participantsNotFound)
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
                console.warn(messages.logs.fileNotFound(file_to_transcribe))
                continue
            }

            try {
                let text = await this.transcribeAudio(file_to_transcribe)
                text = this.filterNoise(text)

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
                const error_message = error instanceof Error ? error.message : String(error)
                console.error(messages.logs.transcriptionFileError(segment.file, error_message))
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
