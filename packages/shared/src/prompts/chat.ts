/**
 * ego Graphica - チャットプロンプト
 */

import type { Persona, WritingStyle } from "../types"

/** システムプロンプト構築用のオプション */
export interface ChatSystemPromptOptions {
    persona: Persona | null
    context: string
    writing_style: WritingStyle | null
    style_samples: string[]
}

/**
 * チャット用システムプロンプトを構築
 */
export function buildChatSystemPrompt(options: ChatSystemPromptOptions): string {
    const { persona, context, writing_style, style_samples } = options
    let prompt = `あなたはアーティストの代わりに顧客対応を行うAIエージェント「ego Graphica」です。`

    if (persona) {
        prompt += `\n\n## キャラクター設定`
        if (persona.character) {
            prompt += `\nあなたの名前は「${persona.character}」です。`
        }
        if (persona.motif) {
            prompt += `\nモチーフ: ${persona.motif}`
        }
        if (persona.philosophy) {
            prompt += `\n創作哲学: ${persona.philosophy}`
        }

        if (persona.influences && persona.influences.length > 0) {
            prompt += `\n影響を受けた作家・文化: ${persona.influences.join("、")}`
        }

        if (persona.avoidances && persona.avoidances.length > 0) {
            prompt += `\n\n## 避けるべきトピック\n${persona.avoidances.join("、")}についての話題は避けてください。`
        }

        if (persona.samples && persona.samples.length > 0) {
            prompt += `\n\n## 応答例`
            for (const sample of persona.samples) {
                prompt += `\n\n状況: ${sample.situation}`
                prompt += `\n顧客: ${sample.message}`
                prompt += `\n応答: ${sample.response}`
            }
        }
    }

    // 口調分析をCAGキャッシュから適用
    if (writing_style) {
        prompt += `\n\n## 文体ガイド（CAG）`
        prompt += `\n${writing_style.description}`
        prompt += `\n- 文末表現: ${writing_style.sentence_endings.join("、")}`
        prompt += `\n- フォーマル度: ${writing_style.formality_level < 0.4 ? "カジュアル" : writing_style.formality_level < 0.7 ? "やや丁寧" : "フォーマル"}`
        if (writing_style.characteristic_phrases.length > 0) {
            prompt += `\n- 特徴的フレーズ: ${writing_style.characteristic_phrases.join("、")}`
        }
        if (writing_style.punctuation.uses_emoji) {
            prompt += `\n- 絵文字を適度に使用`
        }
        if (writing_style.punctuation.uses_exclamation) {
            prompt += `\n- 感嘆符（！）を使用`
        }
    }

    // 実際の文章サンプル
    if (style_samples.length > 0) {
        prompt += `\n\n## 参考文章（この人の実際の書き方）`
        for (const sample of style_samples.slice(0, 3)) {
            prompt += `\n「${sample}」`
        }
    }

    if (context) {
        prompt += `\n\n## 参考情報（RAG）\n以下の情報を参考にして回答してください:\n\n${context}`
    }

    prompt += `\n\n## 応答ルール（厳守）
1. 顧客への返答を1-2文で書く
2. 返答を書き終えたら、shouldContinue ツールを呼び出す（テキストで説明しない）
3. shouldContinue で have_more_to_say: true を返した場合、ツール結果を受け取ったら次の話題について新しいメッセージを書く

shouldContinue ツールのパラメータ:
- have_more_to_say: 続けて話したいなら true、終わりなら false
- next_topic: 次の話題（なければ「なし」）

## 継続時の動作
ツール結果で「続けてください」と指示されたら、新しい短いメッセージを書いてください。各メッセージは独立した吹き出しとして表示されます。

## 禁止事項
- ツールについてテキストで説明しない
- 「shouldContinue」という単語を顧客に見せない
- 長文を書かない（1-2文まで）

## 応答スタイル
- 上記の文体ガイドに従って自然に話す
- アーティストらしい個性を持って対応
- わからないことは「確認します」と伝える`

    return prompt
}
