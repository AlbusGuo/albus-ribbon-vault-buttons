/**
 * 将插件设置写入合并为单一串行流程.
 * 所有实际磁盘写入仍由 Obsidian Plugin.saveData() 完成.
 */
export class SettingsWriteQueue<T extends object> {
	private tail: Promise<void> = Promise.resolve();
	private pendingSnapshot: T | null = null;

	constructor(private readonly write: (snapshot: T) => Promise<void>) {}

	save(snapshot: T): Promise<void> {
		this.pendingSnapshot = structuredClone(snapshot);
		const operation = this.tail.then(
			() => this.writeLatestSnapshot(),
			() => this.writeLatestSnapshot(),
		);
		this.tail = operation;
		return operation;
	}

	whenIdle(): Promise<void> {
		return this.tail;
	}

	private async writeLatestSnapshot(): Promise<void> {
		const snapshot = this.pendingSnapshot;
		this.pendingSnapshot = null;
		if (snapshot) {
			await this.write(snapshot);
		}
	}
}
