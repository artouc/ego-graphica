/**
 * ユーザー向けメッセージの定義
 * 文言変更や多言語化はこのファイルを起点に行う
 */

export const messages = {
    bot: {
        ready: (username: string) => `🤖 ${username} がオンラインになりました`,
        shutdownInitiated: "🔄 シャットダウンを開始します...",
        shutdownComplete: "✅ シャットダウンが完了しました"
    },

    recording: {
        // 開始
        starting: "🎙️ 録音を開始しています...",
        started: (channelName: string) =>
            `✅ **${channelName}** での録音を開始しました！\n停止するには \`/egographica stop\` を使用してください。`,
        alreadyRecording: "⚠️ このサーバーではすでに録音が進行中です。",
        notInVoiceChannel: "⚠️ ボイスチャンネルに参加してからコマンドを実行してください。",

        // 停止
        stopping: "⏹️ 録音を停止しています...",
        stopped: (duration: string, participants: number) =>
            `✅ 録音を停止しました\n⏱️ 時間: ${duration}\n👥 参加者: ${participants}名`,
        notRecording: "⚠️ このサーバーでは録音が開始されていません。",

        // エラー
        joinFailed: (error: string) => `❌ ボイスチャンネルへの接続に失敗しました: ${error}`,
        recordingFailed: (error: string) => `❌ 録音中にエラーが発生しました: ${error}`,
        stopFailed: (error: string) => `❌ 録音の停止中にエラーが発生しました: ${error}`,

        // ファイル情報
        filesSaved: (directory: string) => `📁 録音データを保存しました: ${directory}`,
        participantJoined: (username: string) => `🎤 ${username} が参加しました`,
        participantLeft: (username: string) => `👋 ${username} が退出しました`
    },

    commands: {
        // 権限エラー
        missingPermissions: "⚠️ このコマンドを実行する権限がありません。",
        guildOnly: "⚠️ このコマンドはサーバー内でのみ使用できます。",

        // 一般エラー
        error: (error: string) => `❌ エラーが発生しました: ${error}`,
        unknownError: "❌ 不明なエラーが発生しました。"
    },

    voice: {
        connecting: "🔌 ボイスチャンネルに接続中...",
        connected: "✅ ボイスチャンネルに接続しました",
        disconnecting: "🔌 ボイスチャンネルから切断中...",
        disconnected: "✅ ボイスチャンネルから切断しました",
        connectingTo: (channelId: string, guildId: string) =>
            `🔌 ボイスチャンネルに接続中... (Channel: ${channelId}, Guild: ${guildId})`,
        stateChanged: (oldState: string, newState: string) =>
            `🔌 接続状態変更: ${oldState} → ${newState} (${newState})`,
        waitingReady: "⏳ Ready状態を待機中...",
        connectionError: (error: string) => `❌ ボイス接続エラー: ${error}`,
        connectionTimeout: (error: string, status: string) =>
            `ボイスチャンネルへの接続がタイムアウトしました。\n` +
            `エラー: ${error}\n` +
            `状態: ${status}\n\n` +
            `確認事項:\n` +
            `1. Botに「接続」「発言」「音声検出を使用」の権限があるか\n` +
            `2. Botがサーバーに正しく招待されているか\n` +
            `3. ボイスチャンネルが利用可能か\n` +
            `4. Botが他のボイスチャンネルに接続していないか`
    },

    upload: {
        // アップロード開始
        starting: "📤 録音データをアップロード中...",
        converting: "🔄 音声ファイルをMP3に変換中...",
        convertingProgress: (current: number, total: number) =>
            `🔄 MP3変換中... (${current}/${total})`,
        uploading: "☁️ Firebase Storageにアップロード中...",
        uploadingProgress: (current: number, total: number, percent: number) =>
            `☁️ アップロード中... ${current}/${total} (${percent}%)`,

        // アップロード完了
        completed: (duration: string, file_count: number, total_size: string) =>
            `✅ **アップロード完了**\n⏱️ 処理時間: ${duration}\n📦 ファイル数: ${file_count}\n💾 合計サイズ: ${total_size}`,
        downloadLinks: "🔗 **ダウンロードリンク**",
        linksExpire: (days: number) => `⚠️ リンクは${days}日間有効です`,

        // エラー
        failed: (error: string) => `❌ アップロードに失敗しました: ${error}`,
        convertFailed: (error: string) => `❌ MP3変換に失敗しました: ${error}`,
        firebaseNotConfigured:
            "⚠️ Firebase Storage が設定されていません。録音ファイルはローカルに保存されます。",

        // ファイル情報
        audioFiles: "🎵 音声ファイル",
        metadata: "📋 メタデータ",
        transcriptFile: "📝 **文字起こしファイル**"
    },

    transcription: {
        // 文字起こし開始
        starting: "📝 文字起こしを開始しています...",
        processing: (current: number, total: number) => `📝 文字起こし中... (${current}/${total})`,
        generating: "✍️ 会話形式のテキストを生成中...",

        // 完了
        completed: (duration: string, total_chars: number) =>
            `✅ **文字起こし完了**\n⏱️ 処理時間: ${duration}\n📄 文字数: ${total_chars.toLocaleString()}`,
        preview: "📄 **プレビュー** (最初の500文字)",

        // エラー
        failed: (error: string) => `❌ 文字起こしに失敗しました: ${error}`,
        notConfigured: "⚠️ OpenAI API が設定されていません。文字起こしはスキップされます。",
        disabled: "ℹ️ 文字起こし機能は無効化されています。"
    },

    logs: {
        // Bot起動・停止
        botStarting: "🚀 ego Graphica Bot を起動しています...",
        signalReceived: (signal: string) => `\n⚠️  ${signal} を受信しました`,

        // 録音関連
        recordingStarted: (guildId: string, channelName: string) =>
            `🎙️ 録音開始: Guild ${guildId}, Channel ${channelName}`,
        recordingStopped: (guildId: string) => `⏹️ 録音停止: Guild ${guildId}`,
        recordingStartedDir: (dir: string) => `🎙️ 録音開始: ${dir}`,
        recordingStoppedDir: (dir: string, duration: number) =>
            `⏹️ 録音停止: ${dir} (${duration}ms)`,

        // 参加者
        participantAdded: (displayName: string, username: string) =>
            `👤 参加者追加: ${displayName} (${username})`,
        segmentEnded: (file: string, duration: number) =>
            `✅ セグメント終了: ${file} (${duration}ms)`,

        // ファイル処理
        mp3Converted: (count: number) => `✅ ${count} ファイルをMP3に変換しました`,
        metadataSaved: "💾 メタデータを保存しました",
        mp3Converting: (wavFile: string, mp3File: string) =>
            `🔄 MP3変換中: ${wavFile} -> ${mp3File}`,

        // アップロード
        uploadCompleted: (fileCount: number, totalSize: string) =>
            `✅ アップロード完了: ${fileCount} ファイル (${totalSize})`,

        // 文字起こし
        transcriptionCompleted: (charCount: number, duration: string) =>
            `✅ 文字起こし完了: ${charCount} 文字 (${duration})`,

        // コマンド
        commandError: (error: string) => `コマンド実行エラー: ${error}`,
        recordingStartError: (error: string) => `録音開始エラー: ${error}`,
        recordingStopError: (error: string) => `録音停止エラー: ${error}`,
        transcriptionError: (error: string) => `文字起こしエラー: ${error}`,
        uploadError: (error: string) => `アップロードエラー: ${error}`,
        deployStarting: "📝 スラッシュコマンドを登録しています...",
        deploySuccessGuild: (guildId: string) =>
            `✅ ギルド ${guildId} にコマンドを登録しました`,
        deploySuccessGlobal: "✅ グローバルコマンドを登録しました",
        deployError: (error: string) => `コマンド登録エラー: ${error}`,
        loginError: (error: string) => `ログインエラー: ${error}`,
        stopGuildRecording: (guildId: string) => `⏹️ Guild ${guildId} の録音を停止しました`,
        stopGuildRecordingError: (guildId: string, error: string) =>
            `録音停止エラー (Guild ${guildId}): ${error}`,

        // エラー
        audioStreamError: (userId: string, error: string) =>
            `音声ストリームエラー (${userId}): ${error}`,
        segmentEndError: (userId: string, error: string) =>
            `セグメント終了エラー (${userId}): ${error}`,
        recordingEndError: (userId: string, error: string) =>
            `録音終了エラー (${userId}): ${error}`,
        transcriptionFileError: (file: string, error: string) =>
            `❌ 文字起こしエラー (${file}): ${error}`,
        mp3ConvertError: (wavFile: string, error: string) =>
            `❌ MP3変換エラー (${wavFile}): ${error}`,
        fileNotFound: (file: string) => `⚠️ ファイルが見つかりません: ${file}`,
        transcriptFileSendError: (error: string) => `文字起こしファイル送信エラー: ${error}`
    },

    errors: {
        // 録音関連
        alreadyRecording: "すでに録音が開始されています",
        notRecording: "録音が開始されていません",
        connectionTimeout: (error: string, status: string) =>
            `ボイスチャンネルへの接続がタイムアウトしました。\n` +
            `エラー: ${error}\n` +
            `状態: ${status}\n\n` +
            `確認事項:\n` +
            `1. Botに「接続」「発言」「音声検出を使用」の権限があるか\n` +
            `2. Botがサーバーに正しく招待されているか\n` +
            `3. ボイスチャンネルが利用可能か\n` +
            `4. Botが他のボイスチャンネルに接続していないか`,

        // ストレージ関連
        sessionDirCreationFailed: (error: string) => `セッションディレクトリの作成に失敗: ${error}`,
        metadataSaveFailed: (error: string) => `メタデータの保存に失敗: ${error}`,
        mp3ConvertFailed: (wavFile: string) => `MP3変換に失敗: ${wavFile}`,
        firebaseNotInitialized: "Firebase Storage が初期化されていません",

        // 文字起こし関連
        openaiNotInitialized: "OpenAI クライアントが初期化されていません",
        segmentsNotFound: "segments.jsonl が見つかりません",
        participantsNotFound: "participants.json が見つかりません",

        // その他
        unknownError: "不明なエラー",
        botStartFailed: (error: string) => `Bot の起動に失敗しました: ${error}`,
        unhandledRejection: (error: string) => `未処理の Promise エラー: ${error}`,
        uncaughtException: (error: string) => `未処理の例外: ${error}`
    },

    deploy: {
        starting: "🚀 スラッシュコマンドをデプロイしています...",
        completed: "✅ デプロイが完了しました",
        failed: (error: string) => `❌ デプロイに失敗しました: ${error}`
    },

    env: {
        validationFailed: "⚠️  環境変数の検証に失敗しました:",
        validationIssue: (path: string, message: string) => `  - ${path}: ${message}`,
        directoryCreated: (dir: string) => `📁 ディレクトリを作成しました: ${dir}`,
        directoryCreationFailed: (dir: string, error: string) =>
            `❌ ディレクトリの作成に失敗しました: ${dir} ${error}`,
        firebaseIncomplete: "⚠️ Firebase Storage の設定が不完全です。アップロード機能は無効化されます。",
        firebaseInitialized: "✅ Firebase Storage を初期化しました",
        firebaseInitFailed: (error: string) => `❌ Firebase Storage の初期化に失敗: ${error}`,
        transcriptionDisabled: "ℹ️ 文字起こし機能は無効化されています",
        openaiKeyMissing:
            "⚠️ OpenAI API Key が設定されていません。文字起こし機能は無効化されます。",
        openaiInitialized: "✅ OpenAI クライアントを初期化しました",
        openaiInitFailed: (error: string) => `❌ OpenAI クライアントの初期化に失敗: ${error}`
    }
}
