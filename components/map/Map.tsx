'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Navigation, Globe } from 'lucide-react';

// Fix Leaflet's default icon paths in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to handle map clicks
function MapEvents({ onMapClick }: { onMapClick?: (lngLat: { lng: number; lat: number }) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({ lng: e.latlng.lng, lat: e.latlng.lat });
      }
    },
  });
  return null;
}

// Component to programmatically fly to a location
function MapController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 16, { animate: true, duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

// Icon factories
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color};" class="w-5 h-5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] border-2 border-white"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const glowingIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="relative flex items-center justify-center w-8 h-8">
           <div class="absolute w-full h-full bg-blue-500 rounded-full animate-ping opacity-60"></div>
           <div class="relative w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg"></div>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

interface MapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  markers?: Array<{
    id: string;
    lng: number;
    lat: number;
    color?: string;
  }>;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  className?: string;
}

export default function Map({
  center = [73.2215, 34.1495], // Default to Abbottabad (lng, lat)
  zoom = 13,
  markers = [],
  onMapClick,
  className = "w-full h-full",
}: MapProps) {
  // Map expects [lat, lng]
  const defaultLeafletCenter: [number, number] = [center[1], center[0]];
  
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);
  const [currentLoc, setCurrentLoc] = useState<[number, number] | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Language toggle state (true = English, false = Local/Urdu)
  const [isEnglish, setIsEnglish] = useState(true);

  const TILE_EN = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  const TILE_LOCAL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Pakistan rough bounding box
  const PAKISTAN_BOUNDS: L.LatLngBoundsExpression = [
    [23.6, 60.8], // Southwest
    [37.1, 77.8], // Northeast
  ];

  const fetchSuggestions = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    try {
      // Use Photon API instead of Nominatim for superior fuzzy search, typos, and partial matches
      // bbox=minLon,minLat,maxLon,maxLat restricts search to Pakistan
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&bbox=60.8,23.6,77.8,37.1`);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setShowSuggestions(true);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 400); // slightly faster debounce for better autocomplete feel
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
    } else {
      fetchSuggestions(searchQuery);
    }
  };

  const handleSelectSuggestion = (place: any) => {
    // Photon uses GeoJSON format
    const props = place.properties;
    const [lon, lat] = place.geometry.coordinates;
    
    const displayName = [props.name, props.city, props.state].filter(Boolean).join(', ');
    
    setSearchQuery(displayName);
    setShowSuggestions(false);
    setFlyToTarget([lat, lon]);
    if (onMapClick) onMapClick({ lat, lng: lon });
  };

  const handleLocateMe = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLoc([latitude, longitude]);
        setFlyToTarget([latitude, longitude]);
        if (onMapClick) onMapClick({ lat: latitude, lng: longitude });
      }, (err) => {
        console.error("Geolocation error", err);
        alert("Please enable location permissions in your browser.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className={`relative ${className} leaflet-map-container overflow-hidden`}>
      
      {/* Top Search Bar & Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex flex-col md:flex-row gap-2 pointer-events-none">
        
        {/* Search Bar Container */}
        <div className="flex-1 relative pointer-events-auto">
          <form 
            onSubmit={handleSearch} 
            className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#333] rounded-xl shadow-2xl p-1 flex items-center transition-all focus-within:border-indigo-500 focus-within:shadow-indigo-500/20 w-full"
          >
            <div className="p-2 text-gray-400">
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search locations in Pakistan..."
              className="flex-1 bg-transparent border-none outline-none text-white px-2 placeholder-gray-500"
            />
            <button type="submit" className="hidden"></button>
          </form>

          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a]/95 backdrop-blur-md border border-[#333] rounded-xl shadow-2xl overflow-hidden z-[500] max-h-60 overflow-y-auto">
              {suggestions.map((place, i) => {
                const props = place.properties;
                const title = props.name;
                const subtitle = [props.city, props.state, props.country].filter(Boolean).join(', ');
                return (
                  <li 
                    key={i}
                    onClick={() => handleSelectSuggestion(place)}
                    className="px-4 py-3 cursor-pointer hover:bg-indigo-600/20 border-b border-[#333] last:border-b-0 text-sm transition-colors"
                  >
                    <div className="font-medium text-white truncate">{title}</div>
                    {subtitle && <div className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2 pointer-events-auto self-end md:self-auto">
          <button
            onClick={() => setIsEnglish(!isEnglish)}
            className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#333] text-gray-300 hover:text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors"
            title="Toggle Language"
          >
            <Globe className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm">{isEnglish ? 'EN' : 'UR'}</span>
          </button>

          <button
            onClick={handleLocateMe}
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
            title="Locate Me"
          >
            <Navigation className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Map Container */}
      <MapContainer 
        center={defaultLeafletCenter} 
        zoom={zoom} 
        scrollWheelZoom={true} 
        className="absolute inset-0 z-0 bg-[#0a0a0a]"
        zoomControl={false}
        maxBounds={PAKISTAN_BOUNDS}
        maxBoundsViscosity={1.0}
        minZoom={5}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={isEnglish ? TILE_EN : TILE_LOCAL}
        />
        
        {onMapClick && <MapEvents onMapClick={onMapClick} />}
        <MapController target={flyToTarget} />

        {currentLoc && (
          <Marker position={currentLoc} icon={glowingIcon} />
        )}

        {markers.map((m) => (
          <Marker 
            key={m.id} 
            position={[m.lat, m.lng]} 
            icon={m.color ? createCustomIcon(m.color) : new L.Icon.Default()} 
          />
        ))}
      </MapContainer>
      
      <style jsx global>{`
        .leaflet-map-container .leaflet-container {
          height: 100%;
          width: 100%;
          z-index: 0;
        }
      `}</style>
    </div>
  );
}
