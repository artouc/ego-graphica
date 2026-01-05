# コード規則
1. 変数名は`snake_case`、関数名は`camelCase`、型名は`PascalCase`、環境変数は`CONTACT_CASE`
2. インデントはスペース4つ
3. コード内の命名は冗長でも良いのでわかりやすい名前をつける（NG例: `const handle = () => {}`）
4. 必要ない部分にセミコロンを記載しない
5. ダブルクォーテーションを優先する
6. 後方互換性を保つ必要があると判断した場合はユーザーに確認を行う
7. 定数にフォールバックを用いない（NG例：`web_url: process.env.WEB_URL || 'http://localhost:3000'`
8. 関数にフォールバックを用いず、失敗時にはエラーを返す
9. 全てのエラーメッセージは`packages/shared/src/messages/error.ts`内に記述する
10. 全てのログメッセージは`packages/shared/src/messages/log.ts`内に記述する
11. 全ての型は`packages/shared/src/types/${name}.ts`内に記述する

## モデル名
1. Claude Opusを利用する場合、`claude-opus-4-5`を使用する
2. Claude Sonnetを使用する場合、`claude-sonnet-4-5`を使用する
3. GPT 4o Transcribeを使用する際、`gpt-4o-transcribe`を使用する

## パッケージ
1. `npm install`コマンドを用いてパッケージをインストールし、`package.json`に直接記載しない
2. Nuxt.js 4を使用しているか必ず確認する
3. Nuxt UI 4を使用しているか必ず確認する
4. Vercel AI SDKを優先的に使用する

# 動作規則
1. `llm/models.yaml`に、全てのデータモデルを記載し、実装が変更されたら同ファイルも必ずアップデートする
2. 環境変数が変更されたら`.env.example`を更新する
3. 一括置換が望ましい場合、`temp/`内に`.js`スクリプトを記載して実行することでコードを修正し、使用し終わったらスクリプトを削除する
4. Nuxt UIを用いる際、`llm/nuxt-ui-4-repomix-output.xml`を参照して仕様を把握した上でレスポンシブ対応のUIを作成する
5. バックグラウンドで`npm run dev`を実行せず、必ずユーザーに実行を促す

# UXフロー

1. アーティスト登録画面
- アーティスト名とバケット名を入力するフォームを用意
- Firebase Storageに`/${バケット名}`というフォルダが作成され、Pineconeに`${バケット名}`というNamespaceが作成され、Firestore Databaseに`${バケット名}`というコレクションが作成される

2. 情報提供画面
- `.pdf`、`.mp3`、`.m4a`、`.wav`、`jpg`、`.png`をアップロードできるフォームを用意
- PDFデータの場合[Claude Visual PDFs](https://support.claude.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude)を用いて解析
- 画像データの場合[Claude Vision](https://platform.claude.com/docs/en/build-with-claude/vision)を用いて解析
- 音声データの場合`gpt-4o-transcribe`を用いて解析
- 解析したデータはPineconeの`${バケット名}`Namespaceに格納
- 元データは元のファイル名を維持したままFirebase Storageの`/${バケット名}/raw/`内に階層構造を作らず格納

3. URL提供画面
- URLをインプットできるフォームを用意
- 内容をスクレイピングし本文を検出したのち、Firestore Databaseの`${バケット名}/from-url`コレクションに格納