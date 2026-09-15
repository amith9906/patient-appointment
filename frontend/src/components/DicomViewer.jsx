import React, { useEffect, useRef, useState } from 'react';
import * as dwv from 'dwv';

export default function DicomViewer({ fileUrl, token, title, onClose }) {
  const containerRef = useRef(null);
  const dwvAppRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState('WindowLevel');
  const [sliceIndex, setSliceIndex] = useState(0);
  const [totalSlices, setTotalSlices] = useState(1);
  const [windowCenter, setWindowCenter] = useState(128);
  const [windowWidth, setWindowWidth] = useState(256);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [dicomMeta, setDicomMeta] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const app = new dwv.App();
    dwvAppRef.current = app;

    // Listeners
    app.addEventListener('loadstart', () => {
      if (isMounted) setLoading(true);
    });

    app.addEventListener('load', (event) => {
      if (!isMounted) return;
      setLoading(false);
      
      try {
        const image = app.getImage();
        if (image) {
          const sliceSize = image.getNumberOfSlices ? image.getNumberOfSlices() : 1;
          setTotalSlices(sliceSize);

          const wl = image.getPhotometricInterpretation ? image.getPhotometricInterpretation() : '';
          const meta = {
            rows: image.getRows ? image.getRows() : '-',
            columns: image.getColumns ? image.getColumns() : '-',
            photometric: wl || 'MONOCHROME2',
          };
          setDicomMeta(meta);

          const currentWl = app.getWindowLevel();
          if (currentWl) {
            setWindowCenter(Math.round(currentWl.center || 128));
            setWindowWidth(Math.round(currentWl.width || 256));
          }
        }
      } catch (e) {
        console.warn('Error reading DICOM image metadata:', e);
      }
    });

    app.addEventListener('error', (evt) => {
      if (!isMounted) return;
      console.error('dwv load error:', evt);
      setError(evt.error ? evt.error.message : 'Failed to parse DICOM image format.');
      setLoading(false);
    });

    app.addEventListener('wlchange', (evt) => {
      if (!isMounted) return;
      if (evt.value) {
        setWindowCenter(Math.round(evt.value[0] || 128));
        setWindowWidth(Math.round(evt.value[1] || 256));
      }
    });

    app.addEventListener('zoomchange', (evt) => {
      if (!isMounted) return;
      if (evt.value) {
        setZoomLevel(Math.round((evt.value[0] || 1) * 100));
      }
    });

    app.addEventListener('slicechange', (evt) => {
      if (!isMounted) return;
      if (evt.value) {
        setSliceIndex(evt.value[0] || 0);
      }
    });

    // Initialize DWV container
    app.init({
      dataViewConfigs: {
        '*': [
          {
            divId: 'dwv-layer-container',
            orientation: 'axial',
          },
        ],
      },
      tools: ['WindowLevel', 'Zoom', 'Pan', 'Scroll'],
    });

    // Fetch DICOM file with Auth token if needed and load into DWV
    fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (!isMounted) return;
        const file = new File([buffer], 'scan.dcm', { type: 'application/dicom' });
        app.loadFiles([file]);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Fetch DICOM error:', err);
        setError(`Failed to fetch DICOM file: ${err.message}`);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (dwvAppRef.current) {
        try { dwvAppRef.current.reset(); } catch {}
      }
    };
  }, [fileUrl, token]);

  const setTool = (toolName) => {
    setActiveTool(toolName);
    if (dwvAppRef.current) {
      dwvAppRef.current.setTool(toolName);
    }
  };

  const handleReset = () => {
    if (dwvAppRef.current) {
      dwvAppRef.current.resetDisplay();
      setZoomLevel(100);
      setActiveTool('WindowLevel');
      dwvAppRef.current.setTool('WindowLevel');
    }
  };

  const handleWindowLevelChange = (c, w) => {
    setWindowCenter(c);
    setWindowWidth(w);
    if (dwvAppRef.current) {
      dwvAppRef.current.setWindowLevel(c, w);
    }
  };

  const handleSliceChange = (index) => {
    setSliceIndex(index);
    if (dwvAppRef.current) {
      dwvAppRef.current.setSliceIndex(index);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header Toolbar */}
      <div style={{
        padding: '12px 20px',
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.05em',
            padding: '4px 8px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            borderRadius: '4px'
          }}>
            DICOM VIEWER
          </span>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
            {title || 'Radiology Scan (.dcm)'}
          </h3>
        </div>

        <button
          onClick={onClose}
          style={{
            background: '#334155',
            border: 'none',
            color: '#f8fafc',
            padding: '6px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Left Interactive Tool Panel */}
        <div style={{
          width: '240px',
          backgroundColor: '#1e293b',
          borderRight: '1px solid #334155',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          fontSize: '13px'
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
              Interactive Tools
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { name: 'WindowLevel', label: '☀️ Window / Level (Brightness)' },
                { name: 'Zoom', label: '🔍 Zoom In / Out' },
                { name: 'Pan', label: '✋ Pan / Move' },
                { name: 'Scroll', label: '🎞️ Slice Scroll' },
              ].map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTool(t.name)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: activeTool === t.name ? '1px solid #38bdf8' : '1px solid #334155',
                    backgroundColor: activeTool === t.name ? '#0284c7' : '#0f172a',
                    color: '#ffffff',
                    fontWeight: activeTool === t.name ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contrast & Brightness Manual Controls */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
              Window / Level Controls
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: '12px' }}>
                  <span>Center (Level):</span>
                  <span>{windowCenter}</span>
                </label>
                <input
                  type="range"
                  min="-1000"
                  max="3000"
                  value={windowCenter}
                  onChange={(e) => handleWindowLevelChange(Number(e.target.value), windowWidth)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: '12px' }}>
                  <span>Width (Contrast):</span>
                  <span>{windowWidth}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="4000"
                  value={windowWidth}
                  onChange={(e) => handleWindowLevelChange(windowCenter, Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Multi-frame Slice Navigation */}
          {totalSlices > 1 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Slice Series ({sliceIndex + 1} / {totalSlices})
              </div>
              <input
                type="range"
                min="0"
                max={totalSlices - 1}
                value={sliceIndex}
                onChange={(e) => handleSliceChange(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* View Stats & Reset */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
              Viewport Metadata
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
              <div>Dimensions: {dicomMeta ? `${dicomMeta.columns} x ${dicomMeta.rows}` : 'Loading...'}</div>
              <div>Zoom Scale: {zoomLevel}%</div>
              <div>Photometric: {dicomMeta?.photometric || 'MONOCHROME2'}</div>
            </div>

            <button
              onClick={handleReset}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '8px',
                backgroundColor: '#334155',
                border: 'none',
                color: '#f8fafc',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🔄 Reset View
            </button>
          </div>
        </div>

        {/* Viewport Render Area */}
        <div style={{
          flex: 1,
          backgroundColor: '#000000',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {loading && (
            <div style={{ position: 'absolute', color: '#38bdf8', fontWeight: 600, fontSize: '14px' }}>
              Loading and parsing DICOM image dataset...
            </div>
          )}

          {error && (
            <div style={{ position: 'absolute', color: '#f87171', backgroundColor: '#450a0a', padding: '16px 24px', borderRadius: '8px', border: '1px solid #991b1b', maxWidth: '400px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>DICOM Error</div>
              <div style={{ fontSize: '13px' }}>{error}</div>
            </div>
          )}

          <div
            id="dwv-layer-container"
            ref={containerRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        </div>
      </div>
    </div>
  );
}
