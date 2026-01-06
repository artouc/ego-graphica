/**
 * ego Graphica - ヒアリングセッション
 * Firestore: /{bucket}/hearing/{hearingId}
 * Firestore: /{bucket}/hearing/{hearingId}/messages/{messageId}
 */

import type { Timestamp } from "firebase-admin/firestore"
import type { HearingRole } from "./enums"

/** ヒアリングセッション */
export interface Hearing {
    /** ヒアリングID（Firestore自動生成） */
    id: string
    /** 開始日時 */
    started: Timestamp
    /** 更新日時 */
    updated: Timestamp
    /** メッセージ数 */
    messages: number
    /** 要約 */
    summary?: string
}

/** ヒアリングメッセージ */
export interface HearingMessage {
    /** メッセージID（Firestore自動生成） */
    id: string
    /** ヒアリングID */
    hearing: string
    /** メッセージの役割 */
    role: HearingRole
    /** メッセージ内容 */
    content: string
    /** 作成日時 */
    created: Timestamp
}

/** HearingMessage 作成用 */
export interface HearingMessageCreate {
    hearing: string
    role: HearingRole
    content: string
}
