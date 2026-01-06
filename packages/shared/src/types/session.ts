/**
 * ego Graphica - エージェント会話セッション
 * Firestore: /{bucket}/session/{sessionId}
 * Firestore: /{bucket}/session/{sessionId}/messages/{messageId}
 */

import type { Timestamp } from "firebase-admin/firestore"
import type { MessageRole } from "./enums"

/** Tool Calling実行結果 */
export interface ToolCallResult {
    /** ツール名 */
    name: string
    /** 入力パラメータ */
    input: Record<string, unknown>
    /** 出力結果 */
    output: Record<string, unknown>
    /** 表示に使うVueコンポーネント名 */
    component?: string
}

/** エージェント会話セッション */
export interface Session {
    /** セッションID（Firestore自動生成） */
    id: string
    /** 開始日時 */
    started: Timestamp
    /** 更新日時 */
    updated: Timestamp
    /** メッセージ数 */
    messages: number
    /** AIによる要約 */
    summary?: string
}

/** エージェント会話メッセージ */
export interface SessionMessage {
    /** メッセージID（Firestore自動生成） */
    id: string
    /** セッションID */
    session: string
    /** メッセージの役割 */
    role: MessageRole
    /** メッセージ内容 */
    content: string
    /** Tool Calling結果 */
    tools?: ToolCallResult[]
    /** 作成日時 */
    created: Timestamp
}

/** SessionMessage 作成用 */
export interface SessionMessageCreate {
    session: string
    role: MessageRole
    content: string
    tools?: ToolCallResult[]
}
