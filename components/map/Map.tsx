'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, LocateFixed, Languages, Plus, Minus, MapPin, X } from 'lucide-react';

/* Palette: night #0C2229 · deep #0A1D23 · bone #E8EFEA · mute #8FA8A8 · amber #E9A23B */

type LngLat = { lng: number; lat: number };

const TILE_EN = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_LOCAL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; // fine for dev; self-host tiles before launch

const PAKISTAN_BOUNDS: L.LatLngBoundsExpression = [
  [23.6, 60.8],
  [37.1, 77.8],
];

/* ---------- icons ---------- */
const iconCache: Record<string, L.DivIcon> = {};
const pinIcon = (color: string, label = '') => {
  const key = color + label;
  if (!iconCache[key]) {
    iconCache[key] = L.divIcon({
      className: '',
      html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #0C2229;box-shadow:0 0 0 2px ${color}88,0 8px 16px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:600 13px/1 system-ui,sans-serif;color:#0C2229;cursor:grab">${label}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }
  return iconCache[key];
};

const youIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center">
    <span class="bba-ring" style="position:absolute;inset:0;border-radius:50%;background:#8FB8E8"></span>
    <span style="position:relative;width:14px;height:14px;border-radius:50%;background:#8FB8E8;border:3px solid #0C2229"></span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/* ---------- map helpers ---------- */
function MapEvents({ onMapClick }: { onMapClick: (ll: LngLat) => void }) {
  useMapEvents({ click: (e) => onMapClick({ lng: e.latlng.lng, lat: e.latlng.lat }) });
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 16, { animate: true, duration: 1.2 });
  }, [target, map]);
  return null;
}

function FitBounds({ points, enabled }: { points: [number, number][]; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || points.length < 2) return;
    map.invalidateSize();
    map.fitBounds(points as L.LatLngBoundsExpression, { padding: [70, 70], animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return null;
}

/* ---------- component ---------- */
interface MapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  markers?: Array<{ id: string; lng: number; lat: number; color?: string; label?: string }>;
  onMapClick?: (lngLat: LngLat, label?: string) => void;
  onMarkerDrag?: (id: string, lngLat: LngLat) => void;
  draggableIds?: string[];
  showRoute?: boolean;
  fitToMarkers?: boolean;
  hint?: string;
  accent?: string;
  className?: string;
}

export default function MapView({
  center = [73.2215, 34.1495], // Abbottabad
  zoom = 13,
  markers = [],
  onMapClick,
  onMarkerDrag,
  draggableIds = [],
  showRoute = false,
  fitToMarkers = false,
  hint,
  accent = '#E9A23B',
  className = 'w-full h-full',
}: MapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [youAt, setYouAt] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [isEnglish, setIsEnglish] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const search = async (q: string) => {
    if (!q.trim()) return setResults([]);
    setSearching(true);
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&bbox=60.8,23.6,77.8,37.1`);
      const data = await res.json();
      setResults(data.features || []);
    } catch {
      flash('Search is unavailable. Tap the map instead.');
    } finally {
      setSearching(false);
    }
  };

  const onType = (v: string) => {
    setQuery(v);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 350);
  };

  const pick = (place: any) => {
    const p = place.properties;
    const [lon, lat] = place.geometry.coordinates;
    const name = [p.name, p.city || p.district].filter(Boolean).join(', ');
    setQuery(name);
    setOpen(false);
    setFlyTarget([lat, lon]);
    onMapClick?.({ lat, lng: lon }, name);
  };

  const locate = () => {
    if (!('geolocation' in navigator)) return flash('Location is not supported on this device.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pt: [number, number] = [coords.latitude, coords.longitude];
        setYouAt(pt);
        setFlyTarget(pt);
        onMapClick?.({ lat: pt[0], lng: pt[1] }, 'My current location');
      },
      () => flash('Allow location access in your browser to use this.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pickup = markers.find((m) => m.id === 'pickup');
  const dropoff = markers.find((m) => m.id === 'dropoff');
  const routePts: [number, number][] | null = showRoute && pickup && dropoff ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] : null;

  const ctl =
    'flex h-12 items-center justify-center rounded-[14px] border border-[#E8EFEA]/15 bg-[#0A1D23]/90 text-[#E8EFEA] backdrop-blur-md transition-colors hover:bg-[#123038] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]';

  return (
    <div className={`bba-map relative overflow-hidden ${className} ${isEnglish ? 'tint-en' : 'tint-local'} ${hint ? 'selecting' : ''}`}>
      {/* Search and controls */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[500] flex items-start gap-2">
        <div className="pointer-events-auto relative min-w-0 flex-1">
          <form
            onSubmit={(e) => { e.preventDefault(); results[0] ? pick(results[0]) : search(query); }}
            className="flex h-12 items-center rounded-[14px] border bg-[#0A1D23]/92 pl-3 pr-1 backdrop-blur-md transition-colors"
            style={{ borderColor: open ? accent : 'rgba(232,239,234,.15)' }}
          >
            {searching ? (
              <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
            ) : (
              <Search className="h-[18px] w-[18px] text-[#8FA8A8]" />
            )}
            <input
              value={query}
              onChange={(e) => onType(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Search a place or area"
              aria-label="Search a place"
              className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-[#E8EFEA] outline-none placeholder:text-[#8FA8A8]"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); setResults([]); }} className="flex h-10 w-10 items-center justify-center text-[#8FA8A8] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {open && results.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-2 max-h-64 overflow-y-auto rounded-[14px] border border-[#E8EFEA]/15 bg-[#0A1D23]/97 backdrop-blur-md" role="listbox">
              {results.map((place, i) => {
                const p = place.properties;
                const sub = [p.city || p.district, p.state].filter(Boolean).join(', ');
                return (
                  <li key={i} role="option" aria-selected="false">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(place)}
                      className="flex w-full items-start gap-3 border-b border-[#E8EFEA]/8 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#123038]"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-[#E8EFEA]">{p.name}</span>
                        {sub && <span className="block truncate text-[12px] text-[#8FA8A8]">{sub}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button type="button" onClick={() => setIsEnglish(!isEnglish)} className={`${ctl} gap-2 px-3 text-[13px] font-medium`} aria-label="Switch map labels between English and local" title="Map labels">
            <Languages className="h-[18px] w-[18px] text-[#8FB8E8]" />
            {isEnglish ? 'EN' : 'UR'}
          </button>
          <button type="button" onClick={locate} className={`${ctl} w-12`} style={{ background: accent, color: '#0C2229', borderColor: accent }} aria-label="Use my location" title="Use my location">
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="absolute inset-0 z-0">
      <MapContainer
        ref={setMap}
        center={[center[1], center[0]]}
        zoom={zoom}
        scrollWheelZoom
        zoomControl={false}
        maxBounds={PAKISTAN_BOUNDS}
        maxBoundsViscosity={1}
        minZoom={5}
        className="h-full w-full bg-[#0A1D23]"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url={isEnglish ? TILE_EN : TILE_LOCAL}
          subdomains="abcd"
        />

        {onMapClick && hint && <MapEvents onMapClick={(ll) => onMapClick(ll)} />}
        <FlyTo target={flyTarget} />
        <FitBounds points={markers.map((m) => [m.lat, m.lng])} enabled={fitToMarkers} />

        {routePts && map && <Polyline positions={routePts} pathOptions={{ color: '#E9A23B', weight: 4, dashArray: '1 10', lineCap: 'round' }} />}
        {youAt && <Marker position={youAt} icon={youIcon} interactive={false} />}

        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={pinIcon(m.color || accent, m.label)}
            draggable={draggableIds.includes(m.id)}
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onMarkerDrag?.(m.id, { lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        ))}
      </MapContainer>
      </div>

      {/* Zoom buttons (outside Leaflet's DOM on purpose) */}
      <div className="absolute bottom-9 right-3 z-[400] overflow-hidden rounded-[14px] border border-[#E8EFEA]/15 bg-[#0A1D23]/90 backdrop-blur-md">
        <button type="button" aria-label="Zoom in" onClick={() => map?.zoomIn()} className="flex h-11 w-11 items-center justify-center border-b border-[#E8EFEA]/10 text-[#E8EFEA] transition-colors hover:bg-[#E8EFEA]/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#E9A23B]">
          <Plus className="h-[18px] w-[18px]" />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => map?.zoomOut()} className="flex h-11 w-11 items-center justify-center text-[#E8EFEA] transition-colors hover:bg-[#E8EFEA]/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#E9A23B]">
          <Minus className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Hint and notices */}
      {hint && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] max-w-[calc(100%-5.5rem)] rounded-full border border-[#E8EFEA]/15 bg-[#0A1D23]/90 px-4 py-2 text-[13px] text-[#E8EFEA] backdrop-blur-md">
          <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: accent }} />
          {hint}
        </div>
      )}
      {notice && (
        <div role="status" className="absolute left-1/2 top-[72px] z-[600] -translate-x-1/2 rounded-full bg-[#E8EFEA] px-4 py-2 text-[13px] font-medium text-[#0C2229]">
          {notice}
        </div>
      )}

      <style jsx global>{`
        .bba-map .leaflet-container { height: 100%; width: 100%; background: #0a1d23; font-family: inherit; }
        .bba-map.selecting .leaflet-container { cursor: crosshair; }
        /* Map tint. Tweak these filters to shift the map towards your brand teal. */
        .bba-map.tint-en .leaflet-tile-pane { filter: sepia(1) hue-rotate(150deg) saturate(1.1) brightness(1.15) contrast(1.05); }
        .bba-map.tint-local .leaflet-tile-pane { filter: invert(1) grayscale(1) brightness(.78) contrast(1.1) sepia(1) hue-rotate(150deg) saturate(1.1); }
        .bba-map .leaflet-control-attribution { background: rgba(10,29,35,.85) !important; color: #8fa8a8 !important; font-size: 10px; border-radius: 8px 0 0 0; }
        .bba-map .leaflet-control-attribution a { color: #8fa8a8 !important; }
        @keyframes bba-ping { 0% { transform: scale(.5); opacity: .7 } 100% { transform: scale(1.6); opacity: 0 } }
        .bba-ring { animation: bba-ping 1.8s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .bba-ring { animation: none; opacity: .3; } }
      `}</style>
    </div>
  );
}