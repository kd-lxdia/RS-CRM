// =============================================================================
// Solar Design Studio — Main Page
// =============================================================================

import { useEffect, lazy, Suspense, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDesignStore } from '../../components/solar-studio/store/designStore';
import { useKeyboardShortcuts } from '../../components/solar-studio/hooks/useKeyboardShortcuts';
import TopBar from '../../components/solar-studio/toolbar/TopBar';
import LeftToolbar from '../../components/solar-studio/toolbar/LeftToolbar';
import DesignCanvas from '../../components/solar-studio/canvas/DesignCanvas';
import RightPanel from '../../components/solar-studio/panels/RightPanel';
import SLDView from '../../components/solar-studio/views/SLDView';
import LocationSelector from '../../components/solar-studio/LocationSelector';
import '../../components/solar-studio/StudioStyles.css';

const ThreeJSView = lazy(() => import('../../components/solar-studio/views/ThreeJSView'));

export default function StudioPage() {
  const { designId } = useParams<{ designId: string }>();
  const store = useDesignStore();
  const [showLocationSelector, setShowLocationSelector] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts();

  // Load design on mount
  useEffect(() => {
    if (designId) {
      store.loadDesign(designId);
    } else {
      store.setLocationData(null);
    }
    
    if (!useDesignStore.getState().locationData) {
      setShowLocationSelector(true);
    }
  }, [designId]);

  // Auto-save debounce
  useEffect(() => {
    if (!store.isDirty) return;
    const timer = setTimeout(() => {
      store.saveDesign();
    }, 3000);
    return () => clearTimeout(timer);
  }, [store.isDirty, store.roofs, store.obstructions, store.subArrays,
      store.inverters, store.dimensions, store.textBlocks]);

  const handleLocationSelect = (data: { address: string; lat: number; lng: number; elevation: number; imageUrl: string }) => {
    console.log('Location selected:', data);
    // Store the location data
    store.setLocationData(data);
    setShowLocationSelector(false);
  };

  return (
    <div className="studio-container">
      {showLocationSelector && (
        <LocationSelector
          onClose={() => setShowLocationSelector(false)}
          onLocationSelect={handleLocationSelect}
        />
      )}
      
      <TopBar onOpenLocationSelector={() => setShowLocationSelector(true)} />
      <div className="studio-body">
        <LeftToolbar />

        {/* Main content area — switches between 2D / 3D / SLD */}
        {store.viewMode === '2d' && <DesignCanvas />}

        {store.viewMode === '3d' && (
          <Suspense fallback={
            <div className="studio-canvas-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: '#64748b', fontSize: 14 }}>Loading 3D View...</div>
            </div>
          }>
            <ThreeJSView />
          </Suspense>
        )}

        {store.viewMode === 'sld' && <SLDView />}

        <RightPanel />
      </div>
    </div>
  );
}
