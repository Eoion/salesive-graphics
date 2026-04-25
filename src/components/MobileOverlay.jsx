import DuotoneIcon from './DuotoneIcon';
import { ICONS } from '../editor/duotoneIcons';

export default function MobileOverlay() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
      color: 'var(--text-primary)',
    }}>
      {/* Background Decorative Blobs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '10%',
        width: '150px',
        height: '150px',
        background: 'var(--accent)',
        filter: 'blur(100px)',
        opacity: 0.15,
        borderRadius: '50%',
        zIndex: -1,
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '10%',
        width: '200px',
        height: '200px',
        background: 'var(--purple)',
        filter: 'blur(120px)',
        opacity: 0.1,
        borderRadius: '50%',
        zIndex: -1,
      }} />

      <div style={{
        maxWidth: '400px',
        width: '100%',
        padding: '32px',
        borderRadius: '24px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'var(--accent-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          marginBottom: '8px',
        }}>
          <DuotoneIcon svg={ICONS.fitScreen} size={32} />
        </div>

        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 12px 0',
            letterSpacing: '-0.02em',
            fontFamily: 'Syne, sans-serif',
          }}>
            Open on Desktop
          </h1>
          <p style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: 'var(--text-secondary)',
            margin: 0,
            fontFamily: 'Syne, sans-serif',
          }}>
            The Salesive Graphics Engine is a professional tool designed for high-precision design work. For the best experience, please open this app on a PC or Mac.
          </p>
        </div>

        <div style={{
          width: '100%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--border), transparent)',
        }} />

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            textAlign: 'left',
          }}>
            <DuotoneIcon svg={ICONS.check} size={16} style={{ color: 'var(--green)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Full Canvas Controls</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            textAlign: 'left',
          }}>
            <DuotoneIcon svg={ICONS.check} size={16} style={{ color: 'var(--green)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Advanced Layer Support</span>
          </div>
        </div>
      </div>
      
      <p style={{
        marginTop: '32px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        fontFamily: 'DM Mono, monospace',
      }}>
        salesive.com/graphics
      </p>
    </div>
  );
}
