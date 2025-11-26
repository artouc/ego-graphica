#!/bin/bash

# ego Graphica Discord Bot 管理スクリプト
# Usage: ./bot.sh [cleanup|build|start|stop|restart|status]

set -e

# 設定
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PROJECT_ROOT}/bot.pid"
LOG_FILE="${PROJECT_ROOT}/bot.log"
ERROR_LOG_FILE="${PROJECT_ROOT}/bot.error.log"

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# PIDが実行中かチェック
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# クリーンアップ
cleanup() {
    log_info "クリーンアップを開始します..."
    
    # ビルド成果物の削除
    if [ -d "${PROJECT_ROOT}/dist" ]; then
        rm -rf "${PROJECT_ROOT}/dist"
        log_success "dist/ を削除しました"
    fi
    
    # ログファイルの削除
    if [ -f "$LOG_FILE" ]; then
        rm -f "$LOG_FILE"
        log_success "ログファイルを削除しました"
    fi
    
    if [ -f "$ERROR_LOG_FILE" ]; then
        rm -f "$ERROR_LOG_FILE"
        log_success "エラーログファイルを削除しました"
    fi
    
    # node_modulesは残す（必要に応じてコメント解除）
    # if [ -d "${PROJECT_ROOT}/node_modules" ]; then
    #     rm -rf "${PROJECT_ROOT}/node_modules"
    #     log_success "node_modules/ を削除しました"
    # fi
    
    log_success "クリーンアップが完了しました"
}

# ビルド
build() {
    log_info "ビルドを開始します..."
    
    cd "$PROJECT_ROOT"
    
    # TypeScriptのビルド
    if npm run build; then
        log_success "ビルドが完了しました"
    else
        log_error "ビルドに失敗しました"
        exit 1
    fi
}

# 起動
start() {
    if is_running; then
        local pid
        pid=$(cat "$PID_FILE")
        log_warning "Bot はすでに起動しています (PID: $pid)"
        exit 1
    fi
    
    log_info "Bot を起動しています..."
    
    cd "$PROJECT_ROOT"
    
    # .envファイルの存在確認
    if [ ! -f "${PROJECT_ROOT}/.env" ]; then
        log_error ".env ファイルが見つかりません"
        log_info ".env.example をコピーして .env を作成してください"
        exit 1
    fi
    
    # dist/index.jsの存在確認
    if [ ! -f "${PROJECT_ROOT}/dist/index.js" ]; then
        log_warning "ビルド成果物が見つかりません。ビルドを実行します..."
        build
    fi
    
    # Botをバックグラウンドで起動
    nohup node dist/index.js >> "$LOG_FILE" 2>> "$ERROR_LOG_FILE" &
    local pid=$!
    echo "$pid" > "$PID_FILE"
    
    # 起動確認（2秒待機）
    sleep 2
    if is_running; then
        log_success "Bot が起動しました (PID: $pid)"
        log_info "ログ: $LOG_FILE"
        log_info "エラーログ: $ERROR_LOG_FILE"
    else
        log_error "Bot の起動に失敗しました"
        log_info "エラーログを確認してください: $ERROR_LOG_FILE"
        exit 1
    fi
}

# 停止
stop() {
    if ! is_running; then
        log_warning "Bot は起動していません"
        exit 1
    fi
    
    local pid
    pid=$(cat "$PID_FILE")
    log_info "Bot を停止しています (PID: $pid)..."
    
    # SIGTERM を送信
    kill -TERM "$pid" 2>/dev/null || true
    
    # プロセスが終了するまで待機（最大10秒）
    local count=0
    while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done
    
    # まだ実行中の場合は強制終了
    if ps -p "$pid" > /dev/null 2>&1; then
        log_warning "プロセスが応答しません。強制終了します..."
        kill -KILL "$pid" 2>/dev/null || true
        sleep 1
    fi
    
    rm -f "$PID_FILE"
    log_success "Bot を停止しました"
}

# 再起動
restart() {
    log_info "Bot を再起動します..."
    
    if is_running; then
        stop
    fi
    
    sleep 2
    start
}

# ステータス確認
status() {
    if is_running; then
        local pid
        pid=$(cat "$PID_FILE")
        log_success "Bot は起動中です (PID: $pid)"
        
        # プロセス情報を表示
        echo ""
        ps -p "$pid" -o pid,ppid,etime,command
        
        # ログの最後の10行を表示
        if [ -f "$LOG_FILE" ]; then
            echo ""
            log_info "最新のログ (最後の10行):"
            tail -n 10 "$LOG_FILE"
        fi
    else
        log_warning "Bot は停止しています"
    fi
}

# ログ表示
logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        log_warning "ログファイルが見つかりません"
    fi
}

# エラーログ表示
error_logs() {
    if [ -f "$ERROR_LOG_FILE" ]; then
        tail -f "$ERROR_LOG_FILE"
    else
        log_warning "エラーログファイルが見つかりません"
    fi
}

# ヘルプ
show_help() {
    cat << EOF
ego Graphica Discord Bot 管理スクリプト

使用方法:
    ./bot.sh [コマンド]

コマンド:
    cleanup     ビルド成果物とログをクリーンアップ
    build       TypeScriptをビルド
    start       Botを起動
    stop        Botを停止（exit のエイリアス）
    exit        Botを停止
    restart     Botを再起動
    status      Botの状態を確認
    logs        ログをリアルタイムで表示
    error-logs  エラーログをリアルタイムで表示
    help        このヘルプを表示

例:
    ./bot.sh build      # ビルド
    ./bot.sh start      # 起動
    ./bot.sh status     # 状態確認
    ./bot.sh exit       # 停止
    ./bot.sh restart    # 再起動
EOF
}

# メイン処理
main() {
    case "${1:-}" in
        cleanup)
            cleanup
            ;;
        build)
            build
            ;;
        start)
            start
            ;;
        stop|exit)
            stop
            ;;
        restart)
            restart
            ;;
        status)
            status
            ;;
        logs)
            logs
            ;;
        error-logs)
            error_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "不明なコマンド: ${1:-}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"

