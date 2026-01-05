# egoGraphica - アーティスト営業エージェント

## プロジェクト概要

アーティストの代わりに営業を行う自律型AIエージェント。アーティストの作品、記事、ポッドキャスト音声等を学習し、アーティスト固有の思考パターンとペルソナを反映した顧客対応を実現する。

## コンセプト

```
アーティストの創作物 + ペルソナ設定 → AI営業エージェント → 顧客対応
```

## 主要機能

| 機能 | 説明 |
|------|------|
| RAG | 作品・記事からの関連情報検索 |
| CAG | アーティストペルソナの文脈注入 |
| Tool Calling | 見積もり生成、スケジュール確認、ポートフォリオ表示 |
| Embedding | コンテンツのベクトル化・類似検索 |
| 音声文字起こし | ポッドキャスト等の音声コンテンツ処理 |
| Multimodal RAG | Claude Visionによる画像理解・視覚的類似検索 |

## アーキテクチャ全体図（Monorepo構成）

```
┌─────────────────────────────────────────────────────────────────┐
│                         Monorepo (pnpm workspace)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐   HTTP   ┌─────────────────────┐       │
│  │   apps/web          │ ◀──────▶ │   apps/api          │       │
│  │   (Nuxt 4)          │          │   (Nitro Server)    │       │
│  │                     │          │                     │       │
│  │  • UI Components    │          │  • /chat (Stream)   │       │
│  │  • Pages (SSR)      │          │  • /ingest/*        │       │
│  │  • @ai-sdk/vue      │          │  • firebase-admin   │       │
│  │                     │          │  • RAG Pipeline     │       │
│  └──────────┬──────────┘          └──────────┬──────────┘       │
│             │                                │                   │
│             │    ┌─────────────────────┐     │                   │
│             └───▶│  packages/shared    │◀────┘                   │
│                  │  Types + Zod Schema │                         │
│                  └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ Firebase │         │ Pinecone │         │ Claude   │
  │ Auth/DB  │         │ Vector   │         │ 4.5 Opus │
  │ Storage  │         │ Index    │         │ (Vision) │
  └──────────┘         └──────────┘         └──────────┘
```

## ドキュメント構成

| ファイル | 内容 |
|----------|------|
| [01-tech-stack.md](./01-tech-stack.md) | 技術スタック詳細 |
| [02-data-models.md](./02-data-models.md) | データモデル設計 |
| [03-rag-implementation.md](./03-rag-implementation.md) | RAG実装パターン |
| [04-cag-persona.md](./04-cag-persona.md) | CAG・ペルソナ設計 |
| [05-tool-calling.md](./05-tool-calling.md) | Tool Calling実装 |
| [06-data-pipeline.md](./06-data-pipeline.md) | データ取り込みパイプライン |
| [07-deployment.md](./07-deployment.md) | デプロイ構成 |
| [08-multimodal-rag.md](./08-multimodal-rag.md) | マルチモーダルRAG（Claude Vision） |
| [09-monorepo-architecture.md](./09-monorepo-architecture.md) | Monorepo構成（Nuxt + Nitro分離） |
