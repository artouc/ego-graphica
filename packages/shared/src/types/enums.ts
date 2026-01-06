/**
 * ego Graphica - 列挙型定義
 */

/** 作品ファイル形式 */
export const FileType = {
    PNG: "png",
    JPG: "jpg",
    WAV: "wav",
    MP4: "mp4"
} as const
export type FileType = (typeof FileType)[keyof typeof FileType]

/** 作品の種類 */
export const WorkType = {
    CLIENT: "client",
    PERSONAL: "personal"
} as const
export type WorkType = (typeof WorkType)[keyof typeof WorkType]

/** 販売状況 */
export const SalesStatus = {
    SOLD: "sold",
    RESERVED: "reserved",
    AVAILABLE: "available",
    UNAVAILABLE: "unavailable"
} as const
export type SalesStatus = (typeof SalesStatus)[keyof typeof SalesStatus]

/** メッセージの役割 */
export const MessageRole = {
    USER: "user",
    ASSISTANT: "assistant",
    SYSTEM: "system"
} as const
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole]

/** ヒアリングメッセージの役割 */
export const HearingRole = {
    USER: "user",
    ASSISTANT: "assistant"
} as const
export type HearingRole = (typeof HearingRole)[keyof typeof HearingRole]

/** ベクトルデータソース種別 */
export const SourceType = {
    WORK: "work",
    URL: "url",
    FILE: "file"
} as const
export type SourceType = (typeof SourceType)[keyof typeof SourceType]

/** AIプロバイダー */
export const AIProvider = {
    CLAUDE: "claude",
    GPT4O_MINI: "gpt-4o-mini"
} as const
export type AIProvider = (typeof AIProvider)[keyof typeof AIProvider]
