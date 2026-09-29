import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
// @ts-ignore - MapboxDraw types
import MapboxDraw from '@mapbox/mapbox-gl-draw';
// @ts-ignore - MapboxGeocoder types
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
// @ts-ignore - MapboxDirections types
import MapboxDirections from '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions';
import { Button, message, Space, Card, Statistic, Row, Col, Input } from 'antd';
import { MapPin, Navigation, Trash2, Save, Search } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css';

// Set Mapbox access token - use SolarRoofDesign token
mapboxgl.accessToken = 'pk.eyJ1Ijoic2h1YmhhbTIzNSIsImEiOiJjbWpxdjBjdzUzdmNqM2NxenRsbWw1cXU3In0.IF5T51WvwrSAt2AMtcuzag';

interface MapboxGeofenceProps {
  onZonesSave?: (zones: any[]) => void;
  initialZones?: any[];
}

const MapboxGeofence: React.FC<MapboxGeofenceProps> = ({ onZonesSave, initialZones = [] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<any>(null);
  const directions = useRef<any>(null);
  
  const [lng, setLng] = useState(77.2090); // Delhi longitude
  const [lat, setLat] = useState(28.6139); // Delhi latitude
  const [zoom, setZoom] = useState(10);
  const [zones, setZones] = useState<any[]>(initialZones);
  const [showDirections, setShowDirections] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom,
      attributionControl: true
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Add geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.current.addControl(geolocate, 'top-right');

    // Add geocoder (search)
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: true,
      placeholder: 'Search for places, addresses...',
      countries: 'in' // Restrict to India
    });
    map.current.addControl(geocoder, 'top-left');

    // Initialize drawing tools
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
        line_string: true,
        point: true
      },
      defaultMode: 'simple_select'
    });
    map.current.addControl(draw.current, 'top-left');

    // Initialize directions
    directions.current = new MapboxDirections({
      accessToken: mapboxgl.accessToken,
      unit: 'metric',
      profile: 'mapbox/driving',
      alternatives: true,
      congestion: true,
      controls: {
        inputs: true,
        instructions: true,
        profileSwitcher: true
      }
    });

    // Update coordinates on move
    map.current.on('move', () => {
      if (map.current) {
        setLng(parseFloat(map.current.getCenter().lng.toFixed(4)));
        setLat(parseFloat(map.current.getCenter().lat.toFixed(4)));
        setZoom(parseFloat(map.current.getZoom().toFixed(2)));
      }
    });

    // Handle drawing events
    map.current.on('draw.create', updateZones);
    map.current.on('draw.delete', updateZones);
    map.current.on('draw.update', updateZones);

    // Load initial zones if provided
    if (initialZones.length > 0 && draw.current) {
      initialZones.forEach(zone => {
        draw.current?.add(zone);
      });
    }

    // Trigger geolocation on load
    map.current.on('load', () => {
      geolocate.trigger();
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  const updateZones = () => {
    if (draw.current) {
      const data = draw.current.getAll();
      setZones(data.features);
    }
  };

  const handleSaveZones = () => {
    if (zones.length === 0) {
      message.warning('No zones to save. Draw some polygons first!');
      return;
    }
    
    message.success(`${zones.length} zone(s) saved successfully!`);
    onZonesSave?.(zones);
    
    // Log zone details
    console.log('Saved zones:', zones);
  };

  const handleClearAll = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setZones([]);
      message.info('All zones cleared');
    }
  };

  const toggleDirections = () => {
    if (!map.current || !directions.current) return;

    if (showDirections) {
      map.current.removeControl(directions.current);
      setShowDirections(false);
      message.info('Directions panel hidden');
    } else {
      map.current.addControl(directions.current, 'top-left');
      setShowDirections(true);
      message.success('Directions panel enabled. Enter origin and destination.');
    }
  };

  const addSampleZones = () => {
    if (!draw.current) return;

    // Sample zone around Delhi
    const samplePolygon = {
      type: 'Feature',
      properties: {
        name: 'Sample Zone - Central Delhi'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.1900, 28.6300],
          [77.2300, 28.6300],
          [77.2300, 28.6000],
          [77.1900, 28.6000],
          [77.1900, 28.6300]
        ]]
      }
    };

    draw.current.add(samplePolygon);
    updateZones();
    message.success('Sample zone added!');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      message.warning('Please enter a location to search');
      return;
    }

    const loadingMsg = message.loading('Searching...', 0);

    try {
      const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN || mapboxgl.accessToken;
      
      if (!token) {
        loadingMsg();
        message.error('Mapbox token not configured. Check .env file.');
        console.error('Missing Mapbox token');
        return;
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}&country=in&limit=1`;
      console.log('Searching for:', searchQuery);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      loadingMsg();

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        
        if (response.status === 401) {
          message.error('Invalid Mapbox token. Please check your configuration.');
        } else if (response.status === 429) {
          message.error('Rate limit exceeded. Please try again later.');
        } else {
          message.error(`Search failed: ${response.status} ${response.statusText}`);
        }
        return;
      }

      const data = await response.json();
      console.log('Search results:', data);

      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center;
        const placeName = data.features[0].place_name;

        // Fly to location
        map.current?.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          duration: 2000
        });

        // Add marker
        new mapboxgl.Marker({ color: '#FF0000' })
          .setLngLat([longitude, latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${placeName}</strong>`))
          .addTo(map.current!);

        message.success(`Found: ${placeName}`);
        setSearchQuery('');
      } else {
        message.warning('Location not found. Try: "India Gate" or "110001"');
      }
    } catch (error: any) {
      loadingMsg();
      console.error('Search error:', error);
      
      if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        message.error('Network error. Check your internet connection.');
      } else {
        message.error(`Search failed: ${error.message || 'Unknown error'}`);
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Search Bar Overlay */}
      <Card 
        className="absolute top-4 left-4 z-10 shadow-lg"
        bodyStyle={{ padding: '12px' }}
        style={{ width: '320px' }}
      >
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="Search: India Gate, Delhi or 110001"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<Search size={16} className="text-gray-400" />}
          />
          <Button type="primary" onClick={handleSearch}>
            Search
          </Button>
        </Space.Compact>
        <div className="text-xs text-gray-500 mt-2">
          Try: "Connaught Place", "India Gate", or postal codes
        </div>
      </Card>

      {/* Map Stats Overlay */}
      <Card 
        className="absolute top-4 right-4 z-10 shadow-lg"
        bodyStyle={{ padding: '12px' }}
        style={{ minWidth: '200px' }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Statistic 
              title="Active Zones" 
              value={zones.length} 
              prefix={<MapPin size={16} />}
              valueStyle={{ fontSize: '20px' }}
            />
          </Col>
        </Row>
        <div className="text-xs text-gray-500 mt-2">
          Lng: {lng} | Lat: {lat} | Zoom: {zoom}
        </div>
      </Card>

      {/* Control Panel */}
      <Card 
        className="absolute bottom-4 left-4 z-10 shadow-lg"
        bodyStyle={{ padding: '12px' }}
      >
        <Space direction="vertical" size="small">
          <Button 
            type="primary" 
            icon={<Navigation size={16} />}
            onClick={toggleDirections}
            block
          >
            {showDirections ? 'Hide' : 'Show'} Directions
          </Button>
          
          <Button 
            type="default"
            onClick={addSampleZones}
            block
          >
            Add Sample Zone
          </Button>

          <Button 
            type="primary"
            icon={<Save size={16} />}
            onClick={handleSaveZones}
            disabled={zones.length === 0}
            block
            className="bg-green-600 hover:bg-green-700"
          >
            Save Zones ({zones.length})
          </Button>

          <Button 
            danger
            icon={<Trash2 size={16} />}
            onClick={handleClearAll}
            disabled={zones.length === 0}
            block
          >
            Clear All
          </Button>
        </Space>
      </Card>

      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
    </div>
  );
};

export default MapboxGeofence;
