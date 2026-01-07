/**
 * ego Graphica - AI解析ユーティリティ
 */

import { generateText } from "ai"
import { getClaudeOpus } from "./anthropic"
import { LOG, IMAGE_ANALYSIS_PROMPT } from "@egographica/shared"
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
                        text: IMAGE_ANALYSIS_PROMPT
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

    const formData = new FormData()
    const blob = new Blob([audioBuffer])
    formData.append("file", blob, filename)
    formData.append("model", "gpt-4o-transcribe")
    formData.append("language", "ja")

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
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
