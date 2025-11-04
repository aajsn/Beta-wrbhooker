// script.js

document.getElementById('send-button').addEventListener('click', handleSend);

const STATUS_MSG = document.getElementById('status-message');

/**
 * 状態メッセージを表示するヘルパー関数
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 'success', 'error', 'info'
 */
function displayStatus(message, type = 'info') {
    STATUS_MSG.textContent = message;
    STATUS_MSG.style.display = 'block';
    
    // 背景色を設定
    if (type === 'success') {
        STATUS_MSG.style.backgroundColor = '#43B581'; // Green
    } else if (type === 'error') {
        STATUS_MSG.style.backgroundColor = '#F04747'; // Red
    } else {
        STATUS_MSG.style.backgroundColor = '#7289DA'; // Blurple/Info
    }
}

/**
 * 指定秒数待機する非同期関数
 * @param {number} ms - ミリ秒
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Webhookにメッセージを送信するメインロジック
 */
async function handleSend() {
    const url = document.getElementById('webhook-url').value.trim();
    
    // ★★★ 修正箇所: Webhook名の値を取得 ★★★
    const customUsername = document.getElementById('webhook-username').value.trim();
    // ★★★ ここまで ★★★
    
    const content = document.getElementById('message-content').value.trim();
    const count = parseInt(document.getElementById('send-count').value) || 1;
    const startTimeMinutes = parseInt(document.getElementById('start-time').value) || 0;
    const ttsEnabled = document.getElementById('tts-enabled').checked;
    const fileInput = document.getElementById('file-input');

    if (!url || !content) {
        displayStatus("❌ Webhook URLとメッセージ内容は必須です。", 'error');
        return;
    }
    
    // Webhook URLの簡単な検証
    if (!url.startsWith('https://discord.com/api/webhooks/')) {
        displayStatus("❌ 有効なDiscord Webhook URLを入力してください。", 'error');
        return;
    }

    // 送信ボタンを無効化して多重送信を防ぐ
    document.getElementById('send-button').disabled = true;

    displayStatus("💡 送信処理を開始します...");

    // 1. 開始時間（分後）の待機
    const waitSeconds = startTimeMinutes * 60;
    if (waitSeconds > 0) {
        displayStatus(`⏰ ${startTimeMinutes}分後に送信を開始します...`, 'info');
        await sleep(waitSeconds * 1000);
    }
    
    // 2. 繰り返し送信
    for (let i = 1; i <= count; i++) {
        
        let formData;
        let headers = {};
        let body;
        
        const messagePayload = {
            content: content,
            
            // ★★★ 修正箇所: Webhook名を設定 ★★★
            // 入力があればそれを使用し、なければデフォルトの"Webhook Sender Tool"を使用
            username: customUsername || "Webhook Sender Tool",
            // ★★★ ここまで ★★★
            
            tts: ttsEnabled
        };

        try {
            if (fileInput.files.length > 0) {
                // ファイル添付ありの場合 (FormDataを使用)
                formData = new FormData();
                formData.append('payload_json', JSON.stringify(messagePayload));
                formData.append('file', fileInput.files[0]);
                body = formData;
            } else {
                // ファイル添付なしの場合 (JSONを使用)
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(messagePayload);
            }

            // fetch APIでPOSTリクエスト
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: body
            });

            // 3. レスポンスの確認
            if (response.status === 204) {
                displayStatus(`✅ 第${i}回目: 成功`, 'success');
            } else if (response.status === 429) {
                const responseJson = await response.json();
                const retryAfter = responseJson.retry_after / 1000 || 5;
                displayStatus(`⏳ レート制限。${retryAfter}秒待機して再試行します。`, 'error');
                await sleep(retryAfter * 1000);
                i--; // カウンターを戻して再試行
                continue;
            } else {
                const errorText = await response.text();
                displayStatus(`❌ 第${i}回目: 失敗 (Status: ${response.status}) - ${errorText.substring(0, 50)}...`, 'error');
            }

        } catch (error) {
            displayStatus(`🚨 接続エラー: ${error.message}`, 'error');
            break;
        }

        // 連続送信によるレート制限を避けるための待機
        if (i < count) {
            await sleep(1000);
        }
    }
    
    document.getElementById('send-button').disabled = false; // ボタンを再度有効化
    displayStatus("🏁 全ての送信処理が完了しました。", 'info');
}
