// Web Worker for GeoTracking intervals
let intervalId: number | null = null;

self.onmessage = (e: MessageEvent) => {
    const { type, intervalMinutes } = e.data;

    if (type === 'START_TRACKING') {
        if (intervalId) clearInterval(intervalId);

        // Initial trigger
        self.postMessage({ type: 'TICK' });

        intervalId = self.setInterval(() => {
            self.postMessage({ type: 'TICK' });
        }, intervalMinutes * 60 * 1000);
    }

    if (type === 'STOP_TRACKING') {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }
};
