import * as admin from "firebase-admin"
import ffmpeg from "fluent-ffmpeg"
import fs from "fs"
import path from "path"
import { appConfig } from "../env"
import { messages } from "../messages"

interface UploadResult {
    audio_files: FileInfo[]
    metadata_files: FileInfo[]
    transcript_file?: FileInfo
    total_size: number
    duration_ms: number
}

interface FileInfo {
    name: string
    url: string
    size: number
}

/**
 * StorageService
 * 録音ファイルのMP3変換とFirebase Storageへのアップロードを管理
 */
export class StorageService {
    private storage: admin.storage.Storage | null = null
    private bucket: ReturnType<admin.storage.Storage["bucket"]> | null = null
    private is_initialized: boolean = false

    constructor() {
        this.initialize()
    }

    /**
     * Firebase Admin SDKの初期化
     */
    private initialize() {
        const {
            projectId: project_id,
            privateKey: private_key,
            clientEmail: client_email,
            storageBucket: storage_bucket
        } = appConfig.firebase

        // Firebase設定が不完全な場合は初期化をスキップ
        if (!project_id || !private_key || !client_email || !storage_bucket) {
            console.warn(messages.env.firebaseIncomplete)
            return
        }

        try {
            // 既に初期化されている場合はスキップ
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: project_id,
                        privateKey: private_key,
                        clientEmail: client_email
                    }),
                    storageBucket: storage_bucket
                })
            }

            this.storage = admin.storage()
            this.bucket = this.storage.bucket()
            this.is_initialized = true

            console.log(messages.env.firebaseInitialized)
        } catch (error) {
            const error_message = error instanceof Error ? error.message : String(error)
            console.error(messages.env.firebaseInitFailed(error_message))
        }
    }

    /**
     * 初期化されているかチェック
     */
    isConfigured(): boolean {
        return this.is_initialized
    }

    /**
     * WAVファイルをMP3に変換
     */
    private async convertToMp3(wav_path: string, mp3_path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(wav_path)
                .audioCodec("libmp3lame")
                .audioBitrate(appConfig.recording.mp3Bitrate)
                .audioChannels(2)
                .audioFrequency(48000)
                .on("end", () => resolve())
                .on("error", (error: Error) => reject(error))
                .save(mp3_path)
        })
    }

    /**
     * ディレクトリ内のWAVファイルをMP3に変換
     */
    async convertAllToMp3(
        session_dir: string,
        progress_callback?: (current: number, total: number) => void
    ): Promise<string[]> {
        const files = fs.readdirSync(session_dir)
        const wav_files = files.filter((file) => file.endsWith(".wav"))
        const mp3_paths: string[] = []

        for (let i = 0; i < wav_files.length; i++) {
            const wav_file = wav_files[i]
            const wav_path = path.join(session_dir, wav_file)
            const mp3_file = wav_file.replace(".wav", ".mp3")
            const mp3_path = path.join(session_dir, mp3_file)

            console.log(messages.logs.mp3Converting(wav_file, mp3_file))

            try {
                await this.convertToMp3(wav_path, mp3_path)
                mp3_paths.push(mp3_path)

                // 変換後、元のWAVファイルを削除
                fs.unlinkSync(wav_path)

                if (progress_callback) {
                    progress_callback(i + 1, wav_files.length)
                }
            } catch (error: unknown) {
                const error_message = error instanceof Error ? error.message : String(error)
                console.error(messages.logs.mp3ConvertError(wav_file, error_message))
                throw new Error(messages.errors.mp3ConvertFailed(wav_file))
            }
        }

        console.log(messages.logs.mp3Converted(mp3_paths.length))
        return mp3_paths
    }

    /**
     * ファイルをFirebase Storageにアップロード
     */
    private async uploadFile(
        local_path: string,
        remote_path: string
    ): Promise<{ url: string; size: number }> {
        if (!this.bucket) {
            throw new Error("Firebase Storage が初期化されていません")
        }

        const file = this.bucket.file(remote_path)
        const stats = fs.statSync(local_path)

        await this.bucket.upload(local_path, {
            destination: remote_path,
            metadata: {
                contentType: this.getContentType(local_path)
            }
        })

        // ダウンロードURLを生成（7日間有効）
        const [url] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7日
        })

        return { url, size: stats.size }
    }

    /**
     * コンテンツタイプを取得
     */
    private getContentType(file_path: string): string {
        const ext = path.extname(file_path).toLowerCase()
        const content_types: { [key: string]: string } = {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".json": "application/json",
            ".jsonl": "application/jsonl"
        }
        return content_types[ext] || "application/octet-stream"
    }

    /**
     * タイムスタンプをyyyyMMddHHmmss形式にフォーマット
     */
    private formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const day = String(date.getDate()).padStart(2, "0")
        const hours = String(date.getHours()).padStart(2, "0")
        const minutes = String(date.getMinutes()).padStart(2, "0")
        const seconds = String(date.getSeconds()).padStart(2, "0")
        return `${year}${month}${day}${hours}${minutes}${seconds}`
    }

    /**
     * 録音セッションをアップロード
     */
    async uploadRecording(
        session_dir: string,
        progress_callback?: (current: number, total: number, percent: number) => void
    ): Promise<UploadResult> {
        if (!this.is_initialized || !this.bucket) {
            throw new Error(messages.errors.firebaseNotInitialized)
        }

        const start_time = Date.now()
        const session_name = path.basename(session_dir)

        // セッション名からタイムスタンプを抽出（形式: timestamp_guildId）
        const timestamp_match = session_name.match(/^(\d+)_/)
        const timestamp = timestamp_match ? parseInt(timestamp_match[1], 10) : start_time

        // yyyyMMddHHmmss形式のフォルダ名を生成
        const folder_name = this.formatTimestamp(timestamp)
        const remote_base = `recordings/${folder_name}`

        // ディレクトリ内のすべてのファイルを取得
        const all_files = fs.readdirSync(session_dir)
        const mp3_files = all_files.filter((file) => file.endsWith(".mp3"))
        const json_files = all_files.filter(
            (file) => file.endsWith(".json") || file.endsWith(".jsonl")
        )
        const transcript_file = all_files.find((file) => file === "transcript.txt")

        const total_files =
            mp3_files.length + json_files.length + (transcript_file ? 1 : 0)
        let uploaded_count = 0
        let total_size = 0

        const audio_files: FileInfo[] = []
        const metadata_files: FileInfo[] = []
        let transcript_file_info: FileInfo | undefined = undefined

        // MP3ファイルをアップロード
        for (const mp3_file of mp3_files) {
            const local_path = path.join(session_dir, mp3_file)
            const remote_path = `${remote_base}/${mp3_file}`

            const { url, size } = await this.uploadFile(local_path, remote_path)
            audio_files.push({ name: mp3_file, url, size })
            total_size += size

            uploaded_count++
            const percent = Math.round((uploaded_count / total_files) * 100)
            if (progress_callback) {
                progress_callback(uploaded_count, total_files, percent)
            }
        }

        // メタデータファイルをアップロード
        for (const json_file of json_files) {
            const local_path = path.join(session_dir, json_file)
            const remote_path = `${remote_base}/${json_file}`

            const { url, size } = await this.uploadFile(local_path, remote_path)
            metadata_files.push({ name: json_file, url, size })
            total_size += size

            uploaded_count++
            const percent = Math.round((uploaded_count / total_files) * 100)
            if (progress_callback) {
                progress_callback(uploaded_count, total_files, percent)
            }
        }

        // transcript.txtをアップロード
        if (transcript_file) {
            const local_path = path.join(session_dir, transcript_file)
            const remote_path = `${remote_base}/${transcript_file}`

            const { url, size } = await this.uploadFile(local_path, remote_path)
            transcript_file_info = { name: transcript_file, url, size }
            total_size += size

            uploaded_count++
            const percent = Math.round((uploaded_count / total_files) * 100)
            if (progress_callback) {
                progress_callback(uploaded_count, total_files, percent)
            }
        }

        const duration_ms = Date.now() - start_time

        return {
            audio_files,
            metadata_files,
            transcript_file: transcript_file_info,
            total_size,
            duration_ms
        }
    }

    /**
     * バイトをフォーマット
     */
    formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
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
