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

# 動作規則
1. `llm/models.yaml`に、全てのデータモデルを記載し、実装が変更されたら同ファイルも必ずアップデートする
2. 環境変数が変更されたら`.env.example`を更新する
3. 一括置換が望ましい場合、`temp/`内に`.js`スクリプトを記載して実行することでコードを修正し、使用し終わったらスクリプトを削除する
4. Nuxt UIを用いる際、`llm/nuxt-ui-4-repomix-output.xml`を参照して仕様を把握した上でレスポンシブ対応のUIを作成する
5. バックグラウンドで`npm run dev`を実行せず、必ずユーザーに実行を促す。