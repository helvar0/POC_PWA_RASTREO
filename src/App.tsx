import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Play,
  Square,
  Map as MapIcon,
  Trash2,
  Download,
  Wifi,
  WifiOff,
  Settings,
  Database,
  Navigation,
  Smartphone
} from 'lucide-react';
import { db, addPosition, clearHistory, exportToJSON } from './db/db';
import type { LocationRecord } from './db/db';
import MapComponent from './components/MapComponent';
import BackgroundAudio from './components/BackgroundAudio';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const isSecure = window.isSecureContext;
  const geoAvailable = "geolocation" in navigator;
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [swStatus, setSwStatus] = useState("checking");
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // Sync state with IndexedDB
  const locations = useLiveQuery(() => db.locations.orderBy('timestamp').toArray()) || [];

  useEffect(() => {
    // Check Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setSwStatus("active")).catch(() => setSwStatus("error"));
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) setSwStatus("missing");
      });
    } else {
      setSwStatus("unsupported");
    }

    // Online/Offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    // Initialize Web Worker
    workerRef.current = new Worker(new URL('./workers/tracking-worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'TICK') {
        handleCapturePosition();
      }
    };

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      workerRef.current?.terminate();
    };
  }, []);

  const handleCapturePosition = () => {
    if (!("geolocation" in navigator)) {
      console.error("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentPos([latitude, longitude]);

        const record: Omit<LocationRecord, 'id'> = {
          timestamp: Date.now(),
          latitude,
          longitude,
          accuracy,
          is_synced: navigator.onLine ? 1 : 0
        };

        await addPosition(record);

        if (navigator.onLine) {
          console.log("Simulating Background Sync: Datos subidos al servidor.");
        }
      },
      (error) => console.error("Error capturing position:", error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const toggleTracking = () => {
    if (!isTracking) {
      workerRef.current?.postMessage({
        type: 'START_TRACKING',
        intervalMinutes
      });
      setIsTracking(true);
    } else {
      workerRef.current?.postMessage({ type: 'STOP_TRACKING' });
      setIsTracking(false);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const isSetupReady = isSecure && geoAvailable;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Navigation size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            GeoTracker <span className="text-indigo-400 font-medium">Offline</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {!isStandalone && (
            <button
              onClick={() => deferredPrompt ? handleInstallClick() : setShowInstallHelp(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-white text-sm font-bold rounded-xl transition-all shadow-lg active:scale-95",
                deferredPrompt
                  ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                  : "bg-slate-800 hover:bg-slate-750 border border-slate-700"
              )}
            >
              <Smartphone size={18} />
              <span className="hidden sm:inline">
                {deferredPrompt ? "Instalar App" : "Cómo Instalar"}
              </span>
            </button>
          )}
          <BackgroundAudio isActive={isTracking} />
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider",
            isOnline ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          )}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </header>

      {(!isSecure || !geoAvailable) && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 flex items-center justify-center gap-3 text-amber-400 text-sm font-medium text-center">
          <WifiOff size={16} className="shrink-0" />
          <span>
            {!isSecure
              ? "Contexto No Seguro: Geolocation y PWA solo funcionan con HTTPS o localhost."
              : "Geolocalización no disponible."}
          </span>
        </div>
      )}

      {/* PWA Debug Info (Mobile Only) */}
      {!isStandalone && !deferredPrompt && (
        <div className="md:hidden bg-slate-900/80 px-4 py-2 text-[10px] text-slate-500 border-b border-slate-800 flex justify-between">
          <span>Debug: HTTPS:{String(isSecure)} | SW:{swStatus} | Event:Waiting...</span>
          <span className="text-indigo-400">Verificando Manifiesto...</span>
        </div>
      )}

      <main className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row gap-6 p-6">
        {/* Left Panel: Controls & Status */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          {/* Dashboard Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <Settings size={18} className="text-slate-400" />
              <h2 className="font-semibold text-slate-300">Configuración</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="interval-select" className="text-sm text-slate-400 block mb-3">Intervalo de Rastreo</label>
                <select
                  id="interval-select"
                  disabled={isTracking}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((min) => (
                    <option key={min} value={min}>
                      Cada {min} {min === 1 ? 'minuto' : 'minutos'}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={toggleTracking}
                disabled={!isSetupReady}
                className={cn(
                  "w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg transition-all active:scale-95 shadow-2xl",
                  !isSetupReady && "opacity-50 cursor-not-allowed grayscale",
                  isTracking
                    ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 text-white"
                )}
              >
                {isTracking ? (
                  <><Square size={20} fill="currentColor" /> Detener Rastreo</>
                ) : (
                  <><Play size={20} fill="currentColor" /> Iniciar Rastreo</>
                )}
              </button>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1">
            <div className="flex items-center gap-2 mb-6">
              <Database size={18} className="text-slate-400" />
              <h2 className="font-semibold text-slate-300">Estado Local</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Puntos Guardados</p>
                <p className="text-3xl font-bold text-white">{locations.length}</p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Pendientes de Sincro</p>
                <p className="text-3xl font-bold text-indigo-400">
                  {locations.filter((l: LocationRecord) => !l.is_synced).length}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={exportToJSON}
                  disabled={locations.length === 0}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all disabled:opacity-50 disabled:hover:bg-slate-800"
                >
                  <Download size={20} />
                  <span className="text-xs font-medium">Exportar</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('¿Estás seguro de borrar todo el historial?')) clearHistory();
                  }}
                  disabled={locations.length === 0}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-rose-600 hover:text-white hover:border-rose-500 transition-all disabled:opacity-50 disabled:hover:bg-slate-800"
                >
                  <Trash2 size={20} />
                  <span className="text-xs font-medium">Borrar</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Map */}
        <div className="flex-1 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <MapIcon size={16} />
              <span>Visualización de Ruta</span>
            </div>
            {isTracking && (
              <span className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse bg-indigo-500/10 px-2 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Rastreo en vivo
              </span>
            )}
          </div>

          <MapComponent
            locations={locations}
            currentLocation={currentPos}
          />
        </div>
      </main>

      {/* Manual Install Guide Modal */}
      {showInstallHelp && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
              <Smartphone className="text-indigo-400" /> Instalación Manual
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Chrome está tardando en habilitar el botón automático. Puedes instalarla tú mismo en 2 segundos:
            </p>
            <ol className="space-y-4 mb-8 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400">1</span>
                <span>Pulsa los <strong>tres puntos (⋮)</strong> en la esquina superior derecha de Chrome.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400">2</span>
                <span>Selecciona <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400">3</span>
                <span>Confirma la instalación y ¡listo!</span>
              </li>
            </ol>
            <button
              onClick={() => setShowInstallHelp(false)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
