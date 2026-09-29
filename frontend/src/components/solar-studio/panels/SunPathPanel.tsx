// =============================================================================
// Sun Path Simulation Panel
// =============================================================================

import { useEffect, useRef } from 'react';
import { Play, Info } from 'lucide-react';
import { useDesignStore } from '../store/designStore';
import { calculateSolarPosition } from '../../../utils/solar-calculations';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function SunPathPanel() {
  const store = useDesignStore();
  const animationRef = useRef<number | null>(null);

  const { sunSimulation, locationData } = store;

  // Calculate sun position whenever date/time changes
  useEffect(() => {
    if (!sunSimulation.enabled || !locationData) return;

    // Get timezone offset (you'll need to fetch this from Timezone API)
    const timezoneOffsetMinutes = new Date().getTimezoneOffset() * -1;

    const position = calculateSolarPosition(
      locationData.lat,
      locationData.lng,
      sunSimulation.day,
      sunSimulation.month,
      sunSimulation.hour,
      sunSimulation.minute,
      timezoneOffsetMinutes
    );

    store.setSunSimulation({
      sunAzimuth: position.azimuth,
      sunElevation: position.elevation,
    });
  }, [
    sunSimulation.enabled,
    sunSimulation.day,
    sunSimulation.month,
    sunSimulation.hour,
    sunSimulation.minute,
    locationData,
  ]);

  // Animation loop
  useEffect(() => {
    if (!sunSimulation.isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    let lastTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const delta = now - lastTime;

      if (delta >= 33) {
        // ~30 fps
        lastTime = now;

        if (sunSimulation.playMode === 'hour') {
          // Increment by 15 minutes
          let newMinute = sunSimulation.minute + 15;
          let newHour = sunSimulation.hour;

          if (newMinute >= 60) {
            newMinute = 0;
            newHour += 1;
          }

          if (newHour >= 24) {
            newHour = 0;
            // Stop at end of day
            store.setSunSimulation({ isPlaying: false });
            return;
          }

          store.setSunSimulation({ hour: newHour, minute: newMinute });
        } else {
          // Month mode: increment day
          let newDay = sunSimulation.day + 1;
          const daysInMonth = new Date(
            new Date().getFullYear(),
            sunSimulation.month,
            0
          ).getDate();

          if (newDay > daysInMonth) {
            newDay = 1;
            let newMonth = sunSimulation.month + 1;
            if (newMonth > 12) {
              newMonth = 1;
              // Stop at end of year
              store.setSunSimulation({ isPlaying: false });
              return;
            }
            store.setSunSimulation({ month: newMonth, day: newDay });
          } else {
            store.setSunSimulation({ day: newDay });
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [sunSimulation.isPlaying, sunSimulation.playMode]);

  const handleToggle = () => {
    store.toggleSunSimulation();
  };

  const handlePlayHour = () => {
    store.setSunSimulation({
      isPlaying: !sunSimulation.isPlaying,
      playMode: 'hour',
    });
  };

  const handlePlayMonth = () => {
    store.setSunSimulation({
      isPlaying: !sunSimulation.isPlaying,
      playMode: 'month',
    });
  };

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d3a' }}>
      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500 }}>
            Sun Path Simulation
          </span>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
            }}
            title="Solar position calculated based on date, time, and location"
          >
            <Info size={14} />
          </button>
        </div>
        <button
          onClick={handleToggle}
          style={{
            width: 40,
            height: 20,
            borderRadius: 10,
            border: 'none',
            background: sunSimulation.enabled ? '#3b82f6' : '#2a2d3a',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'white',
              position: 'absolute',
              top: 2,
              left: sunSimulation.enabled ? 22 : 2,
              transition: 'left 0.2s',
            }}
          />
        </button>
      </div>

      {sunSimulation.enabled && (
        <>
          {/* Date */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Date
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="number"
                min="1"
                max="31"
                value={sunSimulation.day}
                onChange={(e) => store.setSunSimulation({ day: parseInt(e.target.value) || 1 })}
                style={{
                  width: 60,
                  background: '#0f1419',
                  border: '1px solid #2a2d3a',
                  borderRadius: 4,
                  padding: '6px 8px',
                  color: '#f1f5f9',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <span style={{ color: '#64748b', alignSelf: 'center' }}>/</span>
              <input
                type="number"
                min="1"
                max="12"
                value={sunSimulation.month}
                onChange={(e) => store.setSunSimulation({ month: parseInt(e.target.value) || 1 })}
                style={{
                  width: 60,
                  background: '#0f1419',
                  border: '1px solid #2a2d3a',
                  borderRadius: 4,
                  padding: '6px 8px',
                  color: '#f1f5f9',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>

            {/* Month slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min="1"
                max="12"
                value={sunSimulation.month}
                onChange={(e) => store.setSunSimulation({ month: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <button
                onClick={handlePlayMonth}
                style={{
                  background: sunSimulation.isPlaying && sunSimulation.playMode === 'month' ? '#3b82f6' : '#2a2d3a',
                  border: 'none',
                  borderRadius: 4,
                  padding: 6,
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <Play size={14} />
              </button>
            </div>

            {/* Month labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingLeft: 4, paddingRight: 4 }}>
              {MONTHS.map((m, i) => (
                <span
                  key={i}
                  style={{
                    color: sunSimulation.month === i + 1 ? '#f59e0b' : '#475569',
                    fontSize: 10,
                    fontWeight: sunSimulation.month === i + 1 ? 600 : 400,
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Time
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="number"
                min="0"
                max="23"
                value={sunSimulation.hour}
                onChange={(e) => store.setSunSimulation({ hour: parseInt(e.target.value) || 0 })}
                style={{
                  width: 60,
                  background: '#0f1419',
                  border: '1px solid #2a2d3a',
                  borderRadius: 4,
                  padding: '6px 8px',
                  color: '#f1f5f9',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <span style={{ color: '#64748b', alignSelf: 'center' }}>:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={sunSimulation.minute}
                onChange={(e) => store.setSunSimulation({ minute: parseInt(e.target.value) || 0 })}
                style={{
                  width: 60,
                  background: '#0f1419',
                  border: '1px solid #2a2d3a',
                  borderRadius: 4,
                  padding: '6px 8px',
                  color: '#f1f5f9',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>

            {/* Hour slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min="0"
                max="23"
                value={sunSimulation.hour}
                onChange={(e) => store.setSunSimulation({ hour: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <button
                onClick={handlePlayHour}
                style={{
                  background: sunSimulation.isPlaying && sunSimulation.playMode === 'hour' ? '#3b82f6' : '#2a2d3a',
                  border: 'none',
                  borderRadius: 4,
                  padding: 6,
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <Play size={14} />
              </button>
            </div>

            {/* Hour labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingLeft: 4, paddingRight: 4 }}>
              {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                <span
                  key={h}
                  style={{
                    color: '#475569',
                    fontSize: 10,
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Sun position info */}
          <div style={{ marginTop: 12, padding: 8, background: '#0f1419', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#64748b' }}>Azimuth:</span>
              <span style={{ color: '#f1f5f9' }}>{sunSimulation.sunAzimuth.toFixed(1)}°</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
              <span style={{ color: '#64748b' }}>Elevation:</span>
              <span style={{ color: '#f1f5f9' }}>{sunSimulation.sunElevation.toFixed(1)}°</span>
            </div>
            {sunSimulation.sunElevation <= 0 && (
              <div style={{ color: '#ef4444', fontSize: 10, marginTop: 4 }}>
                ⚠ Sun below horizon
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
