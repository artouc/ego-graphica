/**
 * ego Graphica - アーティスト基本情報
 * Firestore: /{bucket}/profile
 */

import type { Timestamp } from "firebase-admin/firestore"

/** アーティスト基本情報 */
export interface Profile {
    /** アーティスト名 */
    name: string
    /** バケット名（一意識別子） */
    bucket: string
    /** 作成日時 */
    created: Timestamp
    /** 更新日時 */
    updated: Timestamp
}

/** Profile 作成用（Timestampは自動付与） */
export interface ProfileCreate {
    name: string
    bucket: string
}
