/**
 * ジョブキューサービス (Simple FIFO Queue)
 * 重いバックグラウンド処理（画像処理・AI変換など）を
 * サーバーリソースを枯渇させないように直列または限定的な並列数で実行します。
 */
class JobQueueService {
    constructor(concurrency = 1) {
        this.queue = [];
        this.activeCount = 0;
        this.concurrency = concurrency;
    }

    /**
     * ジョブを追加して実行（キューがいっぱいの場合は待機）
     * @param {Function} taskAsync Fn returning a promise
     * @param {string} label 識別用ラベル
     */
    enqueue(taskAsync, label = 'job') {
        return new Promise((resolve, reject) => {
            this.queue.push({ taskAsync, label, resolve, reject });
            this._processNext();
        });
    }

    async _processNext() {
        if (this.activeCount >= this.concurrency || this.queue.length === 0) {
            return;
        }

        const { taskAsync, label, resolve, reject } = this.queue.shift();
        this.activeCount++;

        console.log(`[JobQueue] Starting: ${label} (Pending: ${this.queue.length}, Active: ${this.activeCount})`);
        
        try {
            const result = await taskAsync();
            resolve(result);
        } catch (err) {
            console.error(`[JobQueue] Failed: ${label}`, err);
            reject(err);
        } finally {
            this.activeCount--;
            console.log(`[JobQueue] Finished: ${label} (Remaining: ${this.queue.length})`);
            this._processNext();
        }
    }
}

// 図面登録などの重い処理用に concurrency = 1 (直列) でエクスポート
module.exports = new JobQueueService(1);
