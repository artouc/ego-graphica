<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>egoGraphica</h1>
      <p>アーティストAI営業エージェント</p>
    </header>

    <main class="main">
      <section class="hero">
        <h2>アーティストの代わりに営業するAI</h2>
        <p>
          作品、記事、ポッドキャストを学習し、<br />
          あなたの思考パターンとペルソナを反映した顧客対応を実現
        </p>
      </section>

      <section class="demo">
        <h3>デモを試す</h3>
        <NuxtLink to="/artist/demo/chat" class="demo-link">
          チャットを開始 →
        </NuxtLink>
      </section>

      <section class="api-status">
        <h3>API Status</h3>
        <p>{{ config.public.apiUrl }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #1f2937;
}

.header p {
  color: #6b7280;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hero {
  text-align: center;
  padding: 3rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 1rem;
  color: white;
}

.hero h2 {
  font-size: 1.75rem;
  margin-bottom: 1rem;
}

.hero p {
  opacity: 0.9;
  line-height: 1.8;
}

.demo {
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.demo h3 {
  margin-bottom: 1rem;
}

.demo-link {
  display: inline-block;
  padding: 0.75rem 2rem;
  background: #3b82f6;
  color: white;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: background 0.2s;
}

.demo-link:hover {
  background: #2563eb;
  text-decoration: none;
}

.api-status {
  padding: 1.5rem;
  background: #f3f4f6;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.api-status h3 {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.api-status p {
  font-family: monospace;
  color: #374151;
}
</style>
