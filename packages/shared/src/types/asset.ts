/**
 * ego Graphica - アセットデータ
 * Firestore: /{bucket}/assets/items/{assetId}
 *
 * PDFから抽出した画像やアップロードされた画像を管理
 */

import type { Timestamp } from "firebase-admin/firestore"
import type { ImageAnalysis } from "./work"

/** アセットの種類 */
export type AssetSource = "uploaded" | "pdf-extracted"

/** アセットデータ */
export interface Asset {
    /** アセットID（Firestore自動生成） */
    id: string
    /** Firebase Storage URL */
    url: string
    /** サムネイルURL（オプション） */
    thumbnail_url?: string
    /** ファイル名 */
    filename: string
    /** MIMEタイプ */
    mimetype: string
    /** アセットの種類 */
    source: AssetSource
    /** 元ファイルID（PDF抽出の場合） */
    source_file_id?: string
    /** 元ファイル名（PDF抽出の場合） */
    source_filename?: string
    /** ページ番号（PDF抽出の場合） */
    page_number?: number
    /** Claude Vision解析結果 */
    analysis: ImageAnalysis
    /** 登録日時 */
    created: Timestamp
}

/** Asset 作成用 */
export interface AssetCreate {
    url: string
    thumbnail_url?: string
    filename: string
    mimetype: string
    source: AssetSource
    source_file_id?: string
    source_filename?: string
    page_number?: number
    analysis: ImageAnalysis
}
