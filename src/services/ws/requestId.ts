let seq = 0;

export function makeRequestId(prefix: string): string {
	seq = (seq + 1) % 1_000_000;
	return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}
