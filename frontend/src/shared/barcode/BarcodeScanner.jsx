import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

// Camera-based barcode scan modal. Give it onDetected(code) and onClose();
// it handles starting/stopping the camera stream and permission errors.
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (cancelled) return;
        if (result) onDetected(result.getText());
        // NotFoundException fires continuously between frames with no match - not a real error.
      })
      .then((controls) => {
        if (cancelled) { controls.stop(); return; }
        controlsRef.current = controls;
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not access the camera.');
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">
          Scan barcode
          <button className="btn small ghost" onClick={onClose}>Cancel</button>
        </div>
        {error ? (
          <div className="error-banner">{error} Enable camera access, or select the product manually.</div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline />
            <p style={{ fontSize: 12.5, color: 'var(--text-on-paper-dim)', marginTop: 10, marginBottom: 0 }}>
              Point the camera at the product's barcode.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
