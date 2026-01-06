/**
 * ego Graphica - AI解析ユーティリティ
 */

import { generateText } from "ai"
import { getClaudeOpus } from "./anthropic"
import { getOpenAIClient } from "./openai"
import { LOG } from "@egographica/shared"
import type { ImageAnalysis } from "@egographica/shared"

/** 画像をBase64に変換 */
export function bufferToBase64(buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString("base64")}`
}

/** Claude Visionで画像を解析 */
export async function analyzeImage(
    imageBase64: string,
    mimeType: string
): Promise<ImageAnalysis> {
    console.log(LOG.AI.VISION_ANALYZING)

    const model = getClaudeOpus()

    const prompt = `この画像を詳細に分析し、以下のJSON形式で結果を返してください。日本語で記述してください。

{
    "colors": ["主要な色を3-5個"],
    "colormood": "色の印象（例: 落ち着いた、鮮やか、モノトーン）",
    "composition": "構図の特徴（例: 中央配置、三分割、対角線）",
    "style": "スタイル（例: 写実的、抽象的、印象派風）",
    "technique": "技法（例: 油彩風、水彩風、デジタルアート）",
    "subject": "主題（何が描かれているか）",
    "elements": ["画像内の主要な要素を3-7個"],
    "mood": "全体的な雰囲気（例: 静謐、躍動的、神秘的）",
    "narrative": "この作品が語りかける物語性（1-2文）",
    "tags": ["検索用タグを5-10個"],
    "searchable": "この画像を説明する自然言語テキスト（50-100文字程度）"
}

JSONのみを返してください。`

    const { text } = await generateText({
        model,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image",
                        image: imageBase64
                    },
                    {
                        type: "text",
                        text: prompt
                    }
                ]
            }
        ]
    })

    console.log(LOG.AI.VISION_ANALYZED)

    const json_match = text.match(/\{[\s\S]*\}/)
    if (!json_match) {
        throw new Error("Failed to parse image analysis result")
    }

    return JSON.parse(json_match[0]) as ImageAnalysis
}

/** Claude Visual PDFsでPDFを解析 */
export async function analyzePdf(pdfBase64: string): Promise<string> {
    console.log(LOG.AI.PDF_ANALYZING)

    const model = getClaudeOpus()

    const { text } = await generateText({
        model,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "file",
                        data: pdfBase64,
                        mimeType: "application/pdf"
                    },
                    {
                        type: "text",
                        text: "このPDFの内容を詳細に抽出してください。テキスト、図表の説明、重要なポイントを含めてください。日本語で記述してください。"
                    }
                ]
            }
        ]
    })

    console.log(LOG.AI.PDF_ANALYZED)

    return text
}

/** OpenAI Whisperで音声を文字起こし */
export async function transcribeAudio(
    audioBuffer: Buffer,
    filename: string
): Promise<string> {
    console.log(LOG.AI.AUDIO_TRANSCRIBING)

    const config = useRuntimeConfig()

    const formData = new FormData()
    const blob = new Blob([audioBuffer])
    formData.append("file", blob, filename)
    formData.append("model", "gpt-4o-transcribe")
    formData.append("language", "ja")

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${config.openaiApiKey}`
        },
        body: formData
    })

    if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`)
    }

    const result = await response.json()

    console.log(LOG.AI.AUDIO_TRANSCRIBED)

    return result.text
}
