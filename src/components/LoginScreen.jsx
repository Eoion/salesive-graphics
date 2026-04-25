import React, { useEffect, useState } from 'react';
import DuotoneIcon from './DuotoneIcon';
import { ICONS } from '../editor/duotoneIcons';
import { auth, canvases } from '../lib/api';
import CanvasGallery from './CanvasGallery.jsx';

export default function LoginScreen({ error }) {
  const [publicCanvases, setPublicCanvases] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicCanvases() {
      try {
        const response = await canvases.listPublic();
        if (!cancelled) {
          setPublicCanvases(response.data.data.canvases || []);
        }
      } catch (err) {
        console.error('Failed to load public canvases:', err);
      } finally {
        if (!cancelled) setGalleryLoading(false);
      }
    }

    loadPublicCanvases();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const response = await auth.initiateGoogleAuth(false); // get URL JSON
      const { url } = response.data.data;
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Failed to initiate login:', err);
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      gap: 30,
      padding: '36px',
      overflow: 'auto',
    }}>
      <div style={{
        flex: '0 0 400px',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          padding: 40,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: 'var(--accent-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)'
          }}>
            <DuotoneIcon svg={ICONS.robot} size={32} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: 24, color: 'var(--text-primary)' }}>Welcome Back</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              Sign in to continue to Salesive Graphics Engine
            </p>
          </div>

          {error && (
            <div style={{
              padding: '10px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 12,
              color: '#ef4444',
              fontSize: 12,
              width: '100%',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button 
            onClick={handleGoogleLogin}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '12px 20px',
              background: 'var(--text-primary)',
              color: 'var(--bg-base)',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'transform 0.1s'
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 18 }}>
          Salesive Graphics Engine v1.0
        </p>
      </div>

      <div style={{
        flex: 1,
        minWidth: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
        border: '1px solid rgba(148,163,184,0.12)',
        borderRadius: 28,
        padding: 24,
        overflow: 'hidden',
      }}>
        {galleryLoading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
            Loading public canvases…
          </div>
        ) : (
          <CanvasGallery
            title="Public Canvas Gallery"
            subtitle="See what the community is building. Sign in to remix, iterate, and publish your own."
            canvases={publicCanvases}
            emptyMessage="No public canvases yet. Publish one from the editor and it will show up here."
            showOwner
            compact
          />
        )}
      </div>
    </div>
  );
}
