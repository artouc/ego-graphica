/**
 * ego Graphica - アクティビティログ管理
 */

import { ref } from "vue"

export interface LogEntry {
    id: string
    timestamp: Date
    type: "agent" | "system"
    category?: "RAG" | "CAG" | "LLM" | "TOOL"
    message: string
    duration?: number
}

const logs = ref<LogEntry[]>([])
let log_id_counter = 0

export function useActivityLog() {
    function addLog(entry: Omit<LogEntry, "id" | "timestamp">) {
        logs.value.push({
            ...entry,
            id: `log-${++log_id_counter}`,
            timestamp: new Date()
        })

        // 最大100件に制限
        if (logs.value.length > 100) {
            logs.value = logs.value.slice(-100)
        }
    }

    function addAgentLog(message: string) {
        addLog({ type: "agent", message })
    }

    function addSystemLog(category: LogEntry["category"], message: string, duration?: number) {
        addLog({ type: "system", category, message, duration })
    }

    function clearLogs() {
        logs.value = []
    }

    function formatLogEntry(entry: LogEntry): string {
        if (entry.type === "agent") {
            return `[ego Graphica Agent] ${entry.message}`
        } else {
            const duration_str = entry.duration !== undefined ? `${entry.duration}ms` : ""
            return `[ego Graphica System] ${entry.category}：${duration_str}`
        }
    }

    return {
        logs,
        addLog,
        addAgentLog,
        addSystemLog,
        clearLogs,
        formatLogEntry
    }
}
