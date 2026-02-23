import Dexie, { type Table } from 'dexie';

export interface LocationRecord {
    id?: number;
    timestamp: number;
    latitude: number;
    longitude: number;
    accuracy: number;
    is_synced: number; // 0 for false, 1 for true (IndexedDB prefers simple types for indexing)
}

export class GeoTrackingDB extends Dexie {
    locations!: Table<LocationRecord>;

    constructor() {
        super('GeoTrackingDB');
        this.version(1).stores({
            locations: '++id, timestamp, latitude, longitude, accuracy, is_synced'
        });
    }
}

export const db = new GeoTrackingDB();

// CRUD Functions
export const addPosition = async (position: Omit<LocationRecord, 'id'>) => {
    return await db.locations.add(position);
};

export const getAllPositions = async () => {
    return await db.locations.orderBy('timestamp').toArray();
};

export const clearHistory = async () => {
    return await db.locations.clear();
};

export const exportToJSON = async () => {
    const data = await getAllPositions();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geotracker-export-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
