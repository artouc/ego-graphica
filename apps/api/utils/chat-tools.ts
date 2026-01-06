/**
 * ego Graphica - Chat Tools
 * プロバイダー共通のツール定義と会話ハンドラー
 */

import type Anthropic from "@anthropic-ai/sdk"
import type OpenAI from "openai"

/** ツールパラメータの型 */
interface ToolParameter {
    type: "string" | "boolean" | "number"
    description: string
    enum?: string[]
}

/** 共通ツール定義 */
interface ToolDefinition {
    name: string
    description: string
    parameters: {
        type: "object"
        properties: Record<string, ToolParameter>
        required: string[]
    }
}

/** shouldKeepTalking の入力型 */
export interface ShouldKeepTalkingInput {
    message: string
    have_more_to_say: boolean
    next_topic: string
}

/** ツール実行結果 */
export interface ToolExecutionResult {
    should_continue: boolean
    message: string | null
    result: string
}

/** 会話メッセージ型 */
export interface ConversationMessage {
    role: "user" | "assistant"
    content: string
}

/** 会話実行結果 */
export interface ConversationResult {
    messages: string[]
}

/**
 * 共通ツール定義
 */
export const CHAT_TOOLS: ToolDefinition[] = [
    {
        name: "sendMessage",
        description: "顧客にメッセージを送信する。必ずこのツールを使って応答すること。",
        parameters: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "顧客に送信するメッセージ（1-2文の短いメッセージ）"
                },
                have_more_to_say: {
                    type: "boolean",
                    description: "まだ伝えたいことがあるならtrue、十分ならfalse"
                },
                next_topic: {
                    type: "string",
                    description: "次に話す内容、または「なし」"
                }
            },
            required: ["message", "have_more_to_say", "next_topic"]
        }
    }
]

/**
 * Anthropic SDK形式に変換
 */
export function getAnthropicTools() {
    return CHAT_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
            type: tool.parameters.type,
            properties: tool.parameters.properties,
            required: tool.parameters.required
        }
    }))
}

/**
 * OpenAI SDK形式に変換
 */
export function getOpenAITools() {
    return CHAT_TOOLS.map(tool => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: {
                type: tool.parameters.type,
                properties: tool.parameters.properties,
                required: tool.parameters.required
            }
        }
    }))
}

/**
 * ツールを実行
 */
export function executeTool(
    tool_name: string,
    input: unknown
): ToolExecutionResult {
    switch (tool_name) {
        case "sendMessage": {
            const { message, have_more_to_say, next_topic } = input as ShouldKeepTalkingInput
            console.log("sendMessage:", { message: message?.slice(0, 50), have_more_to_say, next_topic })

            return {
                should_continue: have_more_to_say,
                message: message || null,
                result: JSON.stringify({ sent: true, continue: have_more_to_say, topic: next_topic })
            }
        }
        default:
            console.warn(`Unknown tool: ${tool_name}`)
            return {
                should_continue: false,
                message: null,
                result: JSON.stringify({ error: `Unknown tool: ${tool_name}` })
            }
    }
}

/** 最大ループ回数 */
const MAX_STEPS = 5

/**
 * Claude で会話を実行（ツール呼び出しループ付き）
 */
export async function runClaudeConversation(
    client: Anthropic,
    system_prompt: string,
    conversation_history: ConversationMessage[]
): Promise<ConversationResult> {
    const response_messages: string[] = []
    const tools = getAnthropicTools()

    // Anthropic形式のメッセージ履歴
    type AnthropicMessage = {
        role: "user" | "assistant"
        content: string | Array<
            | { type: "text"; text: string }
            | { type: "tool_use"; id: string; name: string; input: unknown }
            | { type: "tool_result"; tool_use_id: string; content: string }
        >
    }

    const current_messages: AnthropicMessage[] = conversation_history.map(msg => ({
        role: msg.role,
        content: msg.content
    }))

    let should_continue = true
    for (let step = 0; step < MAX_STEPS && should_continue; step++) {
        const response = await client.messages.create({
            model: "claude-opus-4-5",
            max_tokens: 350,
            system: system_prompt,
            messages: current_messages,
            tools
        })

        const assistant_content: Array<
            | { type: "text"; text: string }
            | { type: "tool_use"; id: string; name: string; input: unknown }
        > = []

        // レスポンスを処理
        for (const content of response.content) {
            if (content.type === "text") {
                // テキストレスポンスは無視（ツールからメッセージを取得）
                assistant_content.push({ type: "text", text: content.text })
            } else if (content.type === "tool_use") {
                assistant_content.push({
                    type: "tool_use",
                    id: content.id,
                    name: content.name,
                    input: content.input
                })
            }
        }

        current_messages.push({
            role: "assistant",
            content: assistant_content
        })

        // ツール呼び出しを抽出
        const tool_uses = response.content.filter(
            (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
        )

        if (tool_uses.length === 0) {
            should_continue = false
            break
        }

        // ツールを実行してメッセージを収集
        const tool_results: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = []
        for (const tool_use of tool_uses) {
            const result = executeTool(tool_use.name, tool_use.input)

            // ツールからメッセージを収集
            if (result.message) {
                response_messages.push(result.message)
            }

            tool_results.push({
                type: "tool_result",
                tool_use_id: tool_use.id,
                content: result.result
            })

            if (!result.should_continue) {
                should_continue = false
                break
            }
        }

        if (tool_results.length === 0 || !should_continue) {
            break
        }

        current_messages.push({
            role: "user",
            content: tool_results
        })
    }

    return { messages: response_messages }
}

/**
 * GPT-4o-mini で会話を実行（ツール呼び出しループ付き）
 */
export async function runOpenAIConversation(
    client: OpenAI,
    system_prompt: string,
    conversation_history: ConversationMessage[]
): Promise<ConversationResult> {
    const response_messages: string[] = []
    const tools = getOpenAITools()

    // OpenAI形式のメッセージ履歴
    type OpenAIMessage =
        | { role: "system" | "user" | "assistant"; content: string }
        | { role: "assistant"; content: string | null; tool_calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
        | { role: "tool"; tool_call_id: string; content: string }

    const openai_messages: OpenAIMessage[] = [
        { role: "system", content: system_prompt }
    ]

    for (const msg of conversation_history) {
        openai_messages.push({
            role: msg.role,
            content: msg.content
        })
    }

    let should_continue = true
    for (let step = 0; step < MAX_STEPS && should_continue; step++) {
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 500,
            messages: openai_messages,
            tools,
            // ツール使用を強制
            tool_choice: "required"
        })

        const choice = response.choices[0]
        const message = choice?.message

        // ツール呼び出しがない場合は終了
        if (!message?.tool_calls || message.tool_calls.length === 0) {
            should_continue = false
            break
        }

        // アシスタントメッセージを追加（ツール呼び出し付き）
        openai_messages.push({
            role: "assistant",
            content: message.content,
            tool_calls: message.tool_calls.map(tc => ({
                id: tc.id,
                type: "function" as const,
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments
                }
            }))
        })

        // ツールを実行してメッセージを収集
        for (const tool_call of message.tool_calls) {
            const input = JSON.parse(tool_call.function.arguments)
            const result = executeTool(tool_call.function.name, input)

            // ツールからメッセージを収集
            if (result.message) {
                response_messages.push(result.message)
            }

            openai_messages.push({
                role: "tool",
                tool_call_id: tool_call.id,
                content: result.result
            })

            if (!result.should_continue) {
                should_continue = false
                break
            }
        }
    }

    return { messages: response_messages }
}
