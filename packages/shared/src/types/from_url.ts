/**
 * ego Graphica - URLスクレイピングデータ
 * Firestore: /{bucket}/from-url/{urlId}
 */

import type { Timestamp } from "firebase-admin/firestore"

/** URLスクレイピングデータ */
export interface FromUrl {
    /** URL ID（Firestore自動生成） */
    id: string
    /** 元URL */
    url: string
    /** ページタイトル */
    title?: string
    /** 本文 */
    content: string
    /** スクレイピング日時 */
    scraped: Timestamp
    /** 登録日時 */
    created: Timestamp
}

/** FromUrl 作成用 */
export interface FromUrlCreate {
    url: string
    title?: string
    content: string
}
