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
        disconnected: "✅ ボイスチャンネルから切断しました"
    }
}
