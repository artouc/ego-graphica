# ego Graphica - アーキテクチャ図

> 現在の実装方針をMermaidダイアグラムで可視化

---

## 1. システム全体構成

```mermaid
flowchart TB
    subgraph Client["Nuxt 4 Frontend"]
        Web["apps/web"]
        Pages["Pages"]
        Composables["Composables"]
    end

    subgraph API["Nitro API Server"]
        Routes["apps/api/routes"]
        Utils["apps/api/utils"]
        Middleware["Middleware"]
    end

    subgraph External["External Services"]
        Claude["Claude 4.5 Opus"]
        OpenAI["OpenAI API"]
        Pinecone["Pinecone"]
        Firebase["Firebase"]
    end

    subgraph Firebase
        Firestore["Firestore"]
        Storage["Firebase Storage"]
        Auth["Firebase Auth"]
    end

    Web --> Routes
    Routes --> Utils
    Utils --> Claude
    Utils --> OpenAI
    Utils --> Pinecone
    Utils --> Firestore
    Utils --> Storage
    Middleware --> Auth
```

---

## 2. データフロー図

```mermaid
flowchart LR
    subgraph Input["データ入力"]
        File["ファイル\n(PDF/画像/音声)"]
        URL["URL"]
        Work["作品データ"]
        Persona["ペルソナ設定"]
    end

    subgraph Processing["処理パイプライン"]
        PDF["PDF解析\n(pdfjs-dist)"]
        Vision["画像解析\n(Claude Vision)"]
        Transcribe["文字起こし\n(gpt-4o-transcribe)"]
        Scraper["スクレイピング"]
        Embed["Embedding\n(text-embedding-3-large)"]
    end

    subgraph Storage["データストア"]
        FS["Firestore"]
        VS["Firebase Storage"]
        PC["Pinecone\n(3072次元)"]
    end

    File --> PDF
    File --> Vision
    File --> Transcribe
    URL --> Scraper

    PDF --> Embed
    Vision --> Embed
    Transcribe --> Embed
    Scraper --> Embed

    PDF --> VS
    Vision --> VS
    Transcribe --> VS

    Work --> FS
    Persona --> FS
    Scraper --> FS

    Embed --> PC
```

---

## 3. エージェント会話フロー

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web (Nuxt)
    participant A as API (Nitro)
    participant P as Pinecone
    participant F as Firestore
    participant C as Claude 4.5 Opus

    U->>W: メッセージ送信
    W->>A: POST /api/chat

    A->>P: RAG検索 (セマンティック)
    P-->>A: 関連コンテンツ

    A->>F: ペルソナ取得
    F-->>A: Persona設定

    A->>F: 会話履歴取得
    F-->>A: 過去メッセージ

    Note over A: CAG: システムプロンプト構築

    A->>C: ストリーミングリクエスト
    C-->>A: レスポンス (stream)
    A-->>W: Server-Sent Events
    W-->>U: リアルタイム表示

    A->>F: メッセージ保存
```

---

## 4. 認証フロー

```mermaid
sequenceDiagram
    participant C as Client (Nuxt)
    participant A as API (Nitro)
    participant FA as Firebase Admin

    C->>A: POST /auth/login (email, password)
    A->>FA: verifyIdToken / createUser
    FA-->>A: Custom Token
    A-->>C: Token + User Info

    Note over C: Token保存 (localStorage)

    C->>A: API Request + Bearer Token
    A->>FA: verifyIdToken
    FA-->>A: Decoded Token
    A-->>C: Response
```

---

## 5. Firestoreコレクション構造

```mermaid
erDiagram
    BUCKET ||--|| PROFILE : has
    BUCKET ||--|| PERSONA : has
    BUCKET ||--o{ WORK : contains
    BUCKET ||--o{ FILE : contains
    BUCKET ||--o{ FROM_URL : contains
    BUCKET ||--o{ SESSION : contains
    BUCKET ||--o{ HEARING : contains
    SESSION ||--o{ SESSION_MESSAGE : contains
    HEARING ||--o{ HEARING_MESSAGE : contains

    PROFILE {
        string name
        string bucket
        Timestamp created
        Timestamp updated
    }

    PERSONA {
        string character
        string motif
        PersonaTone tone
        string philosophy
        array influences
        array samples
        array avoidances
        WritingStyle writing_style
        AIProvider provider
    }

    WORK {
        string id
        string url
        FileType filetype
        string title
        Timestamp date
        WorkType worktype
        string client
        SalesStatus status
        string description
        string story
        ImageAnalysis analysis
    }

    FILE {
        string id
        string filename
        string filetype
        map urls
        string preview
        Timestamp created
    }

    FROM_URL {
        string id
        string url
        string title
        string content
        Timestamp scraped
    }

    SESSION {
        string id
        Timestamp started
        Timestamp updated
        number messages
        string summary
    }

    SESSION_MESSAGE {
        string id
        string session
        MessageRole role
        string content
        array tools
        Timestamp created
    }
```

---

## 6. Pineconeベクトル構造

```mermaid
flowchart TB
    subgraph Index["Index: egographica"]
        subgraph NS1["Namespace: {bucket_1}"]
            W1["work_{workId}_chunk_0"]
            W2["work_{workId}_chunk_1"]
            U1["url_{urlId}_chunk_0"]
            F1["file_{fileId}_chunk_0"]
        end
        subgraph NS2["Namespace: {bucket_2}"]
            W3["work_..."]
            U2["url_..."]
            F2["file_..."]
        end
    end

    subgraph Metadata["VectorMetadata"]
        M1["bucket: string"]
        M2["sourcetype: work|url|file"]
        M3["source: DocID"]
        M4["title: string"]
        M5["text: string (max 1000)"]
        M6["chunk_index: number"]
        M7["colors?: string[]"]
        M8["style?: string"]
        M9["mood?: string"]
    end

    W1 --- Metadata
```

---

## 7. ファイル処理パイプライン

```mermaid
flowchart TD
    Upload["ファイルアップロード"]

    Upload --> TypeCheck{ファイル形式}

    TypeCheck -->|PDF| PDF_Process["pdfjs-dist\nテキスト抽出\n+画像抽出"]
    TypeCheck -->|jpg/png| IMG_Process["Claude Vision\n画像解析"]
    TypeCheck -->|mp3/m4a/wav| AUDIO_Process["gpt-4o-transcribe\n文字起こし"]
    TypeCheck -->|mp4| VIDEO_Process["音声抽出\n→文字起こし"]

    PDF_Process --> Chunk["チャンク分割\n(1000文字/200オーバーラップ)"]
    IMG_Process --> Chunk
    AUDIO_Process --> Chunk
    VIDEO_Process --> Chunk

    Chunk --> Embed["Embedding生成\n(text-embedding-3-large)"]

    Embed --> Store["Pinecone保存\n(3072次元ベクトル)"]

    subgraph Storage["Firebase Storage保存"]
        Raw["/{bucket}/data/raw/\n元ファイル"]
        Processed["/{bucket}/data/{fileId}/\n処理済みデータ"]
    end

    Upload --> Raw
    PDF_Process --> Processed
    IMG_Process --> Processed
    AUDIO_Process --> Processed
```

---

## 8. Tool Calling構成

```mermaid
flowchart LR
    subgraph Tools["Available Tools"]
        T1["showPortfolio\n作品表示"]
        T2["checkAvailability\nスケジュール確認"]
        T3["generateQuote\n見積もり生成"]
        T4["showContactForm\n問い合わせフォーム"]
        T5["searchWorks\n作品検索 (RAG)"]
    end

    subgraph Components["Vue Components"]
        C1["PortfolioGrid"]
        C2["AvailabilityCalendar"]
        C3["QuotePreview"]
        C4["ContactForm"]
        C5["SearchResults"]
    end

    T1 --> C1
    T2 --> C2
    T3 --> C3
    T4 --> C4
    T5 --> C5
```

---

## 9. CAG (Context Augmented Generation) フロー

```mermaid
flowchart TD
    subgraph Input["入力"]
        Q["ユーザーメッセージ"]
        H["会話履歴"]
    end

    subgraph Context["コンテキスト収集"]
        RAG["RAG検索結果\n(関連作品・記事)"]
        P["ペルソナ設定"]
        S["セッション履歴"]
    end

    subgraph Prompt["システムプロンプト構築"]
        R1["1. 役割定義"]
        R2["2. キャラクター設定"]
        R3["3. コミュニケーションスタイル"]
        R4["4. 応答例"]
        R5["5. 禁止事項"]
        R6["6. RAGコンテキスト"]
        R7["7. 応答指針"]
    end

    Q --> RAG
    H --> S

    RAG --> R6
    P --> R1
    P --> R2
    P --> R3
    P --> R4
    P --> R5
    S --> R7

    R1 --> LLM["Claude 4.5 Opus"]
    R2 --> LLM
    R3 --> LLM
    R4 --> LLM
    R5 --> LLM
    R6 --> LLM
    R7 --> LLM

    LLM --> Response["ペルソナ反映レスポンス"]
```

---

## 10. ディレクトリ構成

```mermaid
flowchart TB
    subgraph Root["egoGraphica/"]
        subgraph Apps["apps/"]
            subgraph Web["web/ (Nuxt 4)"]
                WP["pages/"]
                WC["components/"]
                WCO["composables/"]
            end
            subgraph API["api/ (Nitro)"]
                AR["routes/"]
                AU["utils/"]
                AM["middleware/"]
            end
        end
        subgraph Packages["packages/"]
            subgraph Shared["shared/"]
                ST["types/"]
                SS["schemas/"]
                SM["messages/"]
            end
        end
        subgraph LLM["llm/"]
            LB["BLUEPRINT.md"]
            LM["models.yaml"]
            LA["architecture.md"]
        end
    end
```

---

## 11. 画面遷移図

```mermaid
flowchart TB
    Index["/\nランディング"]

    subgraph Auth["認証"]
        Register["/register\nアーティスト登録"]
        Login["/login\nログイン"]
    end

    subgraph Dashboard["ダッシュボード"]
        DashIndex["/dashboard\nホーム"]
        Upload["/dashboard/upload\nファイルアップロード"]
        URL["/dashboard/url\nURL提供"]
        Works["/dashboard/works\n作品管理"]
        Persona["/dashboard/persona\nペルソナ設定"]
        Hearing["/dashboard/hearing\nヒアリング"]
    end

    Agent["/agent/{bucket}\nエージェント会話"]

    Index --> Register
    Index --> Login
    Login --> DashIndex
    Register --> DashIndex

    DashIndex --> Upload
    DashIndex --> URL
    DashIndex --> Works
    DashIndex --> Persona
    DashIndex --> Hearing

    DashIndex --> Agent
```

---

## 12. 最適化アーキテクチャ (実装中)

```mermaid
flowchart TB
    subgraph Cache["キャッシュレイヤー"]
        SC["SessionCache\n会話履歴キャッシュ"]
        VC["VectorCache\nRAG結果キャッシュ"]
    end

    subgraph Token["トークン管理"]
        TC["TokenCounter\nトークン計測"]
        TT["trimMessages\n履歴切り詰め"]
    end

    Request["チャットリクエスト"]

    Request --> SC
    SC -->|キャッシュヒット| Response
    SC -->|キャッシュミス| Firestore["Firestore取得"]

    Request --> VC
    VC -->|キャッシュヒット| Context
    VC -->|キャッシュミス| Pinecone["Pinecone検索"]

    Firestore --> TC
    Pinecone --> TC
    TC --> TT
    TT --> LLM["Claude API"]
    LLM --> Response["レスポンス"]
```
