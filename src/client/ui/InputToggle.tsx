import type { InputSource } from '../../input/types.js';

interface InputToggleProps {
  source: InputSource;
  onSwitch: (next: InputSource) => void;
  cameraAvailable: boolean;
  /**
   * When true, the component renders inline (no fixed positioning) so it can
   * live inside a parent bar. Default: false (original fixed bottom-right).
   */
  inline?: boolean;
}

export function InputToggle({ source, onSwitch, cameraAvailable, inline = false }: InputToggleProps) {
  const nextSource: InputSource = source === 'mouse' ? 'camera' : 'mouse';
  const currentLabel = source === 'mouse' ? '🖱 Mouse' : '📷 Camera';
  const buttonLabel = source === 'mouse' ? 'Camera' : 'Mouse';

  const buttonStyle: React.CSSProperties = {
    background: '#2a2a2a',
    color: '#c8873a',
    border: '1px solid #c8873a',
    borderRadius: '20px',
    padding: '6px 14px',
    cursor: cameraAvailable ? 'pointer' : 'not-allowed',
    opacity: cameraAvailable ? 1 : 0.5,
    fontSize: '13px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };

  const labelStyle: React.CSSProperties = {
    color: '#c8873a',
    fontSize: '13px',
    background: '#2a2a2a',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid #c8873a',
    whiteSpace: 'nowrap',
  };

  if (inline) {
    // Inline mode: render as a flat row of label + switch button, no positioning.
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={labelStyle}>{currentLabel}</span>
        <button
          style={buttonStyle}
          disabled={!cameraAvailable}
          title={!cameraAvailable ? 'Camera not available in this browser' : `Switch to ${buttonLabel}`}
          onClick={() => { onSwitch(nextSource); }}
        >
          ⇄ {buttonLabel}
        </button>
      </div>
    );
  }

  // Original fixed bottom-right mode — unchanged behaviour for other callers.
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
    zIndex: 1000,
  };

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>{currentLabel}</span>
      <button
        style={{ ...buttonStyle, padding: '8px 16px', fontSize: '14px' }}
        disabled={!cameraAvailable}
        title={!cameraAvailable ? 'Camera not available in this browser' : undefined}
        onClick={() => { onSwitch(nextSource); }}
      >
        Switch to {buttonLabel}
      </button>
    </div>
  );
}
