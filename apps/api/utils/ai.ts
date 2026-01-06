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

/** PDF抽出結果 */
export interface PdfExtractResult {
    text: string
    images: Buffer[]
}

/** 画像オブジェクトを非同期で取得（コールバック形式をPromise化） */
function getImageObject(page: { objs: { get: (name: string, callback?: (data: unknown) => void) => unknown } }, imageName: string): Promise<{ data: Uint8Array; width: number; height: number } | null> {
    return new Promise((resolve) => {
        const timeout_id = setTimeout(() => {
            resolve(null)
        }, 5000) // 5秒でタイムアウト

        try {
            page.objs.get(imageName, (data: unknown) => {
                clearTimeout(timeout_id)
                resolve(data as { data: Uint8Array; width: number; height: number } | null)
            })
        } catch {
            clearTimeout(timeout_id)
            resolve(null)
        }
    })
}

/** pdfjs-distでPDFからテキストと埋め込み画像を抽出 */
export async function extractPdfContent(pdfBuffer: Buffer): Promise<PdfExtractResult> {
    console.log(LOG.AI.PDF_ANALYZING)

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const { createCanvas } = await import("canvas")

    const data = new Uint8Array(pdfBuffer)
    const pdf = await pdfjsLib.getDocument({ data }).promise

    const texts: string[] = []
    const images: Buffer[] = []
    const processed_images = new Set<string>() // 重複を防ぐ

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)

        // テキスト抽出
        const content = await page.getTextContent()
        const pageText = content.items
            .map((item: { str?: string }) => item.str || "")
            .join(" ")
        texts.push(pageText)

        // 埋め込み画像を抽出
        const ops = await page.getOperatorList()
        const OPS = pdfjsLib.OPS

        for (let j = 0; j < ops.fnArray.length; j++) {
            if (ops.fnArray[j] === OPS.paintImageXObject || ops.fnArray[j] === OPS.paintJpegXObject) {
                const imageName = ops.argsArray[j][0] as string

                // 同じ画像を複数回処理しない
                if (processed_images.has(imageName)) {
                    continue
                }
                processed_images.add(imageName)

                try {
                    // コールバック形式で非同期に画像を取得
                    const img = await getImageObject(page, imageName)

                    if (img && img.data && img.width && img.height) {
                        // 画像データをCanvasに描画してPNGとして出力
                        const canvas = createCanvas(img.width, img.height)
                        const ctx = canvas.getContext("2d")
                        const imageData = ctx.createImageData(img.width, img.height)

                        // RGBAに変換
                        if (img.data.length === img.width * img.height * 4) {
                            // すでにRGBA
                            imageData.data.set(img.data)
                        } else if (img.data.length === img.width * img.height * 3) {
                            // RGBをRGBAに変換
                            for (let k = 0; k < img.width * img.height; k++) {
                                imageData.data[k * 4] = img.data[k * 3]
                                imageData.data[k * 4 + 1] = img.data[k * 3 + 1]
                                imageData.data[k * 4 + 2] = img.data[k * 3 + 2]
                                imageData.data[k * 4 + 3] = 255
                            }
                        } else {
                            // グレースケールをRGBAに変換
                            for (let k = 0; k < img.width * img.height; k++) {
                                const gray = img.data[k]
                                imageData.data[k * 4] = gray
                                imageData.data[k * 4 + 1] = gray
                                imageData.data[k * 4 + 2] = gray
                                imageData.data[k * 4 + 3] = 255
                            }
                        }

                        ctx.putImageData(imageData, 0, 0)
                        images.push(canvas.toBuffer("image/png"))
                    }
                } catch (e) {
                    console.warn(`Failed to extract image ${imageName}:`, e)
                }
            }
        }
    }

    const full_text = texts.join("\n\n")

    console.log("PDF Parse Result:", {
        numPages: pdf.numPages,
        textLength: full_text.length,
        imageCount: images.length
    })

    console.log(LOG.AI.PDF_ANALYZED)

    return { text: full_text, images }
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
