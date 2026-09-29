// =============================================================================
// Location Selector — Google Maps Integration for Solar Studio
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, MapPin } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');

interface LocationSelectorProps {
  onClose: () => void;
  onLocationSelect: (data: { address: string; lat: number; lng: number; elevation: number; imageUrl: string }) => void;
}

// Load Google Maps script once
function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    if (document.getElementById('google-maps-script')) {
      // Already loading — wait for it
      const check = setInterval(() => {
        if ((window as any).google?.maps) { clearInterval(check); resolve(); }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

export default function LocationSelector({ onClose, onLocationSelect }: LocationSelectorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchText, setSearchText] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; elevation: number; address: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const placeMarker = useCallback((latitude: number, longitude: number, address: string) => {
    const google = (window as any).google;
    const pos = { lat: latitude, lng: longitude };

    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new google.maps.Marker({
      position: pos,
      map: mapRef.current,
      title: address,
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#f59e0b',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      }
    });

    mapRef.current.panTo(pos);
    mapRef.current.setZoom(19);

    setLat(latitude.toFixed(6));
    setLng(longitude.toFixed(6));
    setSearchText(address);
    const elevator = new google.maps.ElevationService();
    elevator.getElevationForLocations({
      locations: [pos]
    }, (results: any, status: any) => {
      let elevation = 0;
      if (status === 'OK' && results && results[0]) {
        elevation = results[0].elevation;
      }
      setSelectedLocation({ lat: latitude, lng: longitude, elevation, address });
    });

  }, []);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        const google = (window as any).google;
        if (!mapContainer.current) return;

        // Init map — satellite view, high zoom
        mapRef.current = new google.maps.Map(mapContainer.current, {
          center: { lat: 28.6139, lng: 77.2090 },
          zoom: 18,
          mapTypeId: 'satellite',
          tilt: 0,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControlOptions: {
            mapTypeIds: ['satellite', 'hybrid', 'roadmap'],
          },
        });

        // Click to select
        mapRef.current.addListener('click', async (e: any) => {
          const latitude = e.latLng.lat();
          const longitude = e.latLng.lng();

          // Reverse geocode
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: any) => {
            const address = status === 'OK' && results[0]
              ? results[0].formatted_address
              : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            placeMarker(latitude, longitude, address);
          });
        });

        // Autocomplete on search input
        if (searchInputRef.current) {
          autocompleteRef.current = new google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ['geometry', 'formatted_address', 'name'],
          });
          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current.getPlace();
            if (place.geometry?.location) {
              placeMarker(
                place.geometry.location.lat(),
                place.geometry.location.lng(),
                place.formatted_address || place.name || ''
              );
            }
          });
        }

        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load Google Maps. Check your API key.');
        setLoading(false);
        console.error(err);
      });

    return () => {
      if (markerRef.current) markerRef.current.setMap(null);
    };
  }, [placeMarker]);

  const handleCoordSearch = () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return;

    const google = (window as any).google;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: any) => {
      const address = status === 'OK' && results[0]
        ? results[0].formatted_address
        : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      placeMarker(latitude, longitude, address);
    });
  };

  const handleConfirm = () => {
    if (!selectedLocation) return;
    const { lat, lng, elevation, address } = selectedLocation;

    // Google Static Maps API for satellite cutout
    const zoom = 19;
    const size = '800x800';
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;

    onLocationSelect({ address, lat, lng, elevation, imageUrl });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0f1419',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{
        background: '#1a1d27',
        borderBottom: '1px solid #2a2d3a',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapPin size={18} color="#f59e0b" />
          <div>
            <div style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 600 }}>Select Location</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Search, enter coordinates, or click the map</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: '#64748b',
          cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
        >
          <X size={20} />
        </button>
      </div>

      {/* ── Search Bar ── */}
      <div style={{
        background: '#1a1d27',
        borderBottom: '1px solid #2a2d3a',
        padding: '12px 20px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-end',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Address search */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Search Address
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="e.g. Connaught Place, New Delhi"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0f1419', border: '1px solid #2a2d3a',
                borderRadius: 6, padding: '8px 12px 8px 32px',
                color: '#f1f5f9', fontSize: 13, outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Divider */}
        <div style={{ color: '#2a2d3a', fontSize: 20, paddingBottom: 4 }}>|</div>

        {/* Lat */}
        <div style={{ width: 140 }}>
          <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Latitude
          </label>
          <input
            type="text"
            value={lat}
            onChange={e => setLat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCoordSearch()}
            placeholder="28.6139"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0f1419', border: '1px solid #2a2d3a',
              borderRadius: 6, padding: '8px 12px',
              color: '#f1f5f9', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* Lng */}
        <div style={{ width: 140 }}>
          <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Longitude
          </label>
          <input
            type="text"
            value={lng}
            onChange={e => setLng(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCoordSearch()}
            placeholder="77.2090"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0f1419', border: '1px solid #2a2d3a',
              borderRadius: 6, padding: '8px 12px',
              color: '#f1f5f9', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        <button
          onClick={handleCoordSearch}
          style={{
            background: '#3b82f6', border: 'none', borderRadius: 6,
            padding: '8px 18px', color: 'white', fontSize: 13,
            fontWeight: 500, cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={e => (e.currentTarget.style.background = '#3b82f6')}
        >
          Go
        </button>
      </div>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#0f1419', zIndex: 10, flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, border: '3px solid #2a2d3a',
              borderTopColor: '#f59e0b', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ color: '#64748b', fontSize: 13 }}>Loading Google Maps...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#0f1419', zIndex: 10,
          }}>
            <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>
          </div>
        )}
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

        {/* Crosshair hint */}
        {!loading && !selectedLocation && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#1a1d27cc', border: '1px solid #2a2d3a',
            borderRadius: 8, padding: '8px 16px',
            color: '#94a3b8', fontSize: 12, pointerEvents: 'none',
          }}>
            Click anywhere on the map to select a location
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        background: '#1a1d27',
        borderTop: '1px solid #2a2d3a',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ color: '#94a3b8', fontSize: 13, flex: 1, marginRight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLocation ? (
            <><span style={{ color: '#f59e0b', fontWeight: 600 }}>📍 </span>{selectedLocation.address}</>
          ) : (
            <span style={{ color: '#475569' }}>No location selected yet</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid #2a2d3a',
              borderRadius: 6, padding: '8px 18px',
              color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2a2d3a'; e.currentTarget.style.color = '#f1f5f9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLocation}
            style={{
              background: selectedLocation ? '#f59e0b' : '#1e2030',
              border: 'none', borderRadius: 6,
              padding: '8px 22px', color: selectedLocation ? '#000' : '#475569',
              fontSize: 13, fontWeight: 600,
              cursor: selectedLocation ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (selectedLocation) e.currentTarget.style.background = '#d97706'; }}
            onMouseLeave={e => { if (selectedLocation) e.currentTarget.style.background = '#f59e0b'; }}
          >
            Use This Location
          </button>
        </div>
      </div>
    </div>
  );
}
