import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationRecord } from '../db/db';
import { LocateFixed } from 'lucide-react';

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
    locations: LocationRecord[];
    currentLocation: [number, number] | null;
}

// Helper to center map
function ChangeView({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

const MapComponent: React.FC<MapComponentProps> = ({ locations, currentLocation }) => {
    const [center, setCenter] = useState<[number, number]>([0, 0]);

    useEffect(() => {
        if (currentLocation) {
            setCenter(currentLocation);
        } else if (locations.length > 0) {
            const last = locations[locations.length - 1];
            setCenter([last.latitude, last.longitude]);
        }
    }, [currentLocation, locations]);

    const polylinePositions = locations.map(loc => [loc.latitude, loc.longitude] as [number, number]);

    return (
        <div className="relative w-full h-[400px] md:h-full rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
            <MapContainer
                center={center}
                zoom={13}
                scrollWheelZoom={true}
                className="w-full h-full"
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <ZoomControl position="bottomright" />

                {currentLocation && <ChangeView center={currentLocation} />}

                {locations.length > 0 && (
                    <Polyline
                        positions={polylinePositions}
                        color="#6366f1"
                        weight={4}
                        opacity={0.8}
                        lineJoin="round"
                    />
                )}

                {currentLocation && (
                    <Marker position={currentLocation}>
                        {/* You can add a Popup here if needed */}
                    </Marker>
                )}
            </MapContainer>

            {/* Manual Center Button */}
            <button
                onClick={() => currentLocation && setCenter(currentLocation)}
                className="absolute top-4 right-4 z-[1000] p-3 bg-gray-900/80 backdrop-blur-md border border-gray-700 text-indigo-400 rounded-xl hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                title="Centrar en mi ubicación"
            >
                <LocateFixed size={20} />
            </button>
        </div>
    );
};

export default MapComponent;
