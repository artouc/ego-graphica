/**
 * ego Graphica - 文体分析プロンプト
 */

/**
 * 文体分析プロンプトを生成
 */
export function buildStyleAnalysisPrompt(analysis_text: string): string {
    return `以下のテキストの文体・口調を分析し、JSON形式で結果を返してください。

テキスト:
${analysis_text}

以下のJSON形式で返してください:
{
    "sentence_endings": ["よく使われる文末表現を3-5個"],
    "punctuation": {
        "uses_exclamation": true/false,
        "uses_question_marks": true/false,
        "uses_emoji": true/false,
        "period_style": "。" または "." または "none",
        "comma_style": "、" または ","
    },
    "formality_level": 0.0-1.0の数値（1.0が最もフォーマル）,
    "characteristic_phrases": ["特徴的な言い回しを3-5個"],
    "avoid_patterns": ["使われていないパターンを2-3個"],
    "sentence_length": "short" または "medium" または "long",
    "description": "この人の文体を50文字程度で説明"
}

JSONのみを返してください。`
}
