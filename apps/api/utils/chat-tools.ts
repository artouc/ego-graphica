/**
 * ego Graphica - Chat Tools
 * Anthropic Claude用のツール定義と会話ハンドラー（ストリーミング）
 */

import type Anthropic from "@anthropic-ai/sdk"

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

/** shouldContinue の入力型 */
export interface ShouldContinueInput {
    have_more_to_say: boolean
    next_topic: string
}

/** ツール実行結果 */
export interface ToolExecutionResult {
    should_continue: boolean
    result: string
}

/** 会話メッセージ型 */
export interface ConversationMessage {
    role: "user" | "assistant"
    content: string
}

/** ストリーミングコールバック */
export interface StreamCallbacks {
    onTextDelta: (text: string) => void
    onMessageComplete: (message: string) => void
    onDone: () => void
    onError: (error: Error) => void
}

/**
 * 共通ツール定義
 */
export const CHAT_TOOLS: ToolDefinition[] = [
    {
        name: "shouldContinue",
        description: "テキスト応答を書いた直後に必ず呼び出す。会話を続けるかどうかを判断するための内部ツール。このツールについて顧客に説明してはいけない。",
        parameters: {
            type: "object",
            properties: {
                have_more_to_say: {
                    type: "boolean",
                    description: "続けて話したいならtrue、終わりならfalse"
                },
                next_topic: {
                    type: "string",
                    description: "次の話題、または「なし」"
                }
            },
            required: ["have_more_to_say", "next_topic"]
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
 * ツールを実行
 */
export function executeTool(
    tool_name: string,
    input: unknown
): ToolExecutionResult {
    switch (tool_name) {
        case "shouldContinue": {
            const { have_more_to_say, next_topic } = input as ShouldContinueInput
            // undefined の場合は false として扱う
            const should_continue = have_more_to_say === true
            console.log("shouldContinue:", { have_more_to_say, next_topic, should_continue })

            return {
                should_continue,
                result: JSON.stringify({ continue: should_continue, topic: next_topic || "なし" })
            }
        }
        default:
            console.warn(`Unknown tool: ${tool_name}`)
            return {
                should_continue: false,
                result: JSON.stringify({ error: `Unknown tool: ${tool_name}` })
            }
    }
}

/** 最大ループ回数 */
const MAX_STEPS = 5

/**
 * Claude で会話を実行（ストリーミング）
 */
export async function runClaudeConversationStream(
    client: Anthropic,
    model: string,
    system_prompt: string,
    conversation_history: ConversationMessage[],
    callbacks: StreamCallbacks
): Promise<void> {
    const tools = getAnthropicTools()
    console.log("Claude model:", model)

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
        let current_text = ""
        const tool_uses: Map<number, { id: string; name: string; input: string }> = new Map()

        try {
            const stream = client.messages.stream({
                model,
                max_tokens: 350,
                system: system_prompt,
                messages: current_messages,
                tools
            })

            for await (const event of stream) {
                if (event.type === "content_block_start") {
                    if (event.content_block.type === "tool_use") {
                        console.log("Tool use started:", event.content_block.name, "at index", event.index)
                        tool_uses.set(event.index, {
                            id: event.content_block.id,
                            name: event.content_block.name,
                            input: ""
                        })
                    }
                } else if (event.type === "content_block_delta") {
                    if (event.delta.type === "text_delta") {
                        current_text += event.delta.text
                        callbacks.onTextDelta(event.delta.text)
                    } else if (event.delta.type === "input_json_delta") {
                        const tool = tool_uses.get(event.index)
                        if (tool) {
                            tool.input += event.delta.partial_json
                        }
                    }
                }
            }

            console.log("Stream complete. Text:", current_text.slice(0, 50), "Tools:", tool_uses.size)

            if (current_text.trim()) {
                callbacks.onMessageComplete(current_text.trim())
            }

            const assistant_content: Array<
                | { type: "text"; text: string }
                | { type: "tool_use"; id: string; name: string; input: unknown }
            > = []

            if (current_text) {
                assistant_content.push({ type: "text", text: current_text })
            }

            const tool_list = Array.from(tool_uses.values())
            for (const tool of tool_list) {
                assistant_content.push({
                    type: "tool_use",
                    id: tool.id,
                    name: tool.name,
                    input: tool.input ? JSON.parse(tool.input) : {}
                })
            }

            current_messages.push({
                role: "assistant",
                content: assistant_content
            })

            if (tool_list.length === 0) {
                should_continue = false
                break
            }

            const tool_results: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = []
            for (const tool of tool_list) {
                console.log("Tool input raw:", tool.name, tool.input)
                const input = tool.input ? JSON.parse(tool.input) : {}
                console.log("Tool input parsed:", tool.name, input)
                const result = executeTool(tool.name, input)
                console.log("Tool executed:", tool.name, "should_continue:", result.should_continue)

                tool_results.push({
                    type: "tool_result",
                    tool_use_id: tool.id,
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
        } catch (error) {
            callbacks.onError(error instanceof Error ? error : new Error(String(error)))
            return
        }
    }

    callbacks.onDone()
}
