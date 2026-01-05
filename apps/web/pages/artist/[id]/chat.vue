<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const route = useRoute()
const config = useRuntimeConfig()

const artistId = computed(() => route.params.id as string)

const { messages, input, handleSubmit, isLoading, error } = useChat({
  api: `${config.public.apiUrl}/chat`,
  body: {
    artistId: artistId.value
  }
})
</script>

<template>
  <div class="chat-container">
    <header class="chat-header">
      <NuxtLink to="/" class="back-link">← 戻る</NuxtLink>
      <h1>アーティストチャット</h1>
      <span class="artist-id">ID: {{ artistId }}</span>
    </header>

    <main class="chat-messages">
      <div v-if="messages.length === 0" class="empty-state">
        <p>メッセージを送信してチャットを開始してください</p>
      </div>

      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.role]"
      >
        <div class="message-role">
          {{ message.role === 'user' ? 'あなた' : 'AI' }}
        </div>
        <div class="message-content">
          {{ message.content }}
        </div>
      </div>

      <div v-if="isLoading" class="message assistant loading">
        <div class="message-role">AI</div>
        <div class="message-content">考え中...</div>
      </div>

      <div v-if="error" class="error-message">
        エラーが発生しました: {{ error.message }}
      </div>
    </main>

    <form class="chat-input" @submit="handleSubmit">
      <input
        v-model="input"
        type="text"
        placeholder="メッセージを入力..."
        :disabled="isLoading"
      />
      <button type="submit" :disabled="isLoading || !input.trim()">
        送信
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.back-link {
  color: #6b7280;
  font-size: 0.875rem;
}

.chat-header h1 {
  flex: 1;
  font-size: 1.25rem;
}

.artist-id {
  font-size: 0.75rem;
  color: #9ca3af;
  font-family: monospace;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
}

.message {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
}

.message.user {
  align-self: flex-end;
  background: #3b82f6;
  color: white;
}

.message.assistant {
  align-self: flex-start;
  background: white;
  border: 1px solid #e5e7eb;
}

.message.loading {
  opacity: 0.7;
}

.message-role {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-bottom: 0.25rem;
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.error-message {
  padding: 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.chat-input input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.chat-input input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.chat-input button {
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: background 0.2s;
}

.chat-input button:hover:not(:disabled) {
  background: #2563eb;
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
