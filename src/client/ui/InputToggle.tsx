import type { InputSource } from '../../input/types.js';

interface InputToggleProps {
  source: InputSource;
  onSwitch: (next: InputSource) => void;
  cameraAvailable: boolean;
}

export function InputToggle({ source, onSwitch, cameraAvailable }: InputToggleProps) {
  const nextSource: InputSource = source === 'mouse' ? 'camera' : 'mouse';
  const buttonLabel = source === 'mouse' ? 'Switch to Camera' : 'Switch to Mouse';
  const currentLabel = source === 'mouse' ? '🖱 Mouse' : '📷 Camera';

  const buttonStyle: React.CSSProperties = {
    background: '#2a2a2a',
    color: '#c8873a',
    border: '1px solid #c8873a',
    borderRadius: '20px',
    padding: '8px 16px',
    cursor: cameraAvailable ? 'pointer' : 'not-allowed',
    opacity: cameraAvailable ? 1 : 0.5,
    fontSize: '14px',
    fontFamily: 'inherit',
  };

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

  const labelStyle: React.CSSProperties = {
    color: '#c8873a',
    fontSize: '13px',
    background: '#2a2a2a',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid #c8873a',
  };

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>{currentLabel}</span>
      <button
        style={buttonStyle}
        disabled={!cameraAvailable}
        title={!cameraAvailable ? 'Camera not available in this browser' : undefined}
        onClick={() => { onSwitch(nextSource); }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
