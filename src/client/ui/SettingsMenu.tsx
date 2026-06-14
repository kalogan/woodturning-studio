/**
 * SettingsMenu.tsx — ESC-triggered settings modal overlay.
 *
 * Always mounted (returns null when closed), rendered outside the Canvas as a
 * DOM overlay with a high z-index. Uses inline styles consistent with the
 * app's dark UI (#1a1a1a / #2a2a2a / #c8873a colour palette).
 *
 * Tabs:
 *   Audio         — fully functional (master/ambient/motor/sfx sliders + mute)
 *   Controls      — fully functional (WASD+interact rebinding, reset)
 *   Camera & feel — fully functional (look sensitivity, dial sensitivity, invertY)
 *   Input, Display, Accessibility — "Coming soon" (future slices)
 *
 * The Esc listener lives in App.tsx (global keydown). This component only
 * renders the close (×) button which calls settingsStore.close().
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useSettingsStore, KEY_ACTIONS } from './settingsStore.js';
import type { KeyAction } from './settingsStore.js';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'audio' | 'controls' | 'input' | 'camera' | 'display' | 'accessibility';

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'audio',         label: 'Audio' },
  { id: 'controls',      label: 'Controls' },
  { id: 'input',         label: 'Input' },
  { id: 'camera',        label: 'Camera & feel' },
  { id: 'display',       label: 'Display' },
  { id: 'accessibility', label: 'Accessibility' },
];

// ---------------------------------------------------------------------------
// Styles (consistent with dark UI palette)
// ---------------------------------------------------------------------------

const BACKDROP: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.72)',
  zIndex: 900,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
};

const PANEL: React.CSSProperties = {
  background: '#1e1e1e',
  border: '1px solid #3a3a3a',
  borderRadius: 12,
  width: 850,
  maxWidth: '94vw',
  minHeight: 520,
  maxHeight: '88vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 24px 14px',
  borderBottom: '1px solid #2e2e2e',
  flexShrink: 0,
};

const TITLE: React.CSSProperties = {
  color: '#e0e0e0',
  fontSize: '1.15rem',
  fontWeight: 600,
  margin: 0,
  letterSpacing: '0.02em',
};

const CLOSE_BTN: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #444',
  color: '#888',
  borderRadius: 6,
  width: 30,
  height: 30,
  cursor: 'pointer',
  fontSize: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

const BODY: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const TAB_LIST: React.CSSProperties = {
  width: 160,
  flexShrink: 0,
  borderRight: '1px solid #2e2e2e',
  padding: '12px 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const CONTENT: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '20px 28px',
};

const COMING_SOON: React.CSSProperties = {
  color: '#555',
  fontSize: '0.9rem',
  marginTop: 8,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  const style: React.CSSProperties = {
    padding: '9px 18px',
    textAlign: 'left',
    background: active ? '#2a2a2a' : 'transparent',
    color: active ? '#c8873a' : '#999',
    border: 'none',
    borderLeft: active ? '2px solid #c8873a' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
    transition: 'background 0.1s',
    borderRadius: 0,
  };

  return (
    <button style={style} onClick={onClick}>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Volume slider row
// ---------------------------------------------------------------------------

function VolumeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  };
  const labelStyle: React.CSSProperties = {
    color: '#bbb',
    fontSize: '0.88rem',
    width: 110,
    flexShrink: 0,
  };
  const sliderStyle: React.CSSProperties = {
    flex: 1,
    accentColor: '#c8873a',
    cursor: 'pointer',
  };
  const valueStyle: React.CSSProperties = {
    color: '#888',
    fontSize: '0.82rem',
    width: 34,
    textAlign: 'right',
    flexShrink: 0,
  };

  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        style={sliderStyle}
        onChange={(e) => { onChange(parseFloat(e.target.value)); }}
      />
      <span style={valueStyle}>{Math.round(value * 100)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio panel
// ---------------------------------------------------------------------------

function AudioPanel(): React.ReactElement {
  const {
    audio,
    setMasterVolume,
    setAmbientVolume,
    setMotorVolume,
    setSfxVolume,
    setMuted,
  } = useSettingsStore();

  const sectionTitle: React.CSSProperties = {
    color: '#c8873a',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 14,
    marginTop: 0,
    fontWeight: 600,
  };

  const muteRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  };

  const muteToggleStyle: React.CSSProperties = {
    padding: '6px 14px',
    background: audio.muted ? '#c8873a' : '#2a2a2a',
    color: audio.muted ? '#1a1a1a' : '#bbb',
    border: '1px solid #c8873a',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    fontWeight: 600,
  };

  const divider: React.CSSProperties = {
    borderTop: '1px solid #2a2a2a',
    margin: '10px 0 20px',
  };

  return (
    <div>
      <p style={sectionTitle}>Master</p>

      <div style={muteRowStyle}>
        <button
          style={muteToggleStyle}
          onClick={() => { setMuted(!audio.muted); }}
        >
          {audio.muted ? 'Unmute' : 'Mute all'}
        </button>
        <span style={{ color: '#666', fontSize: '0.82rem' }}>
          {audio.muted ? 'All audio silenced' : 'Audio on'}
        </span>
      </div>

      <VolumeRow
        label="Master volume"
        value={audio.masterVolume}
        onChange={setMasterVolume}
      />

      <div style={divider} />

      <p style={{ ...sectionTitle, marginTop: 0 }}>Channels</p>

      <VolumeRow
        label="Ambient"
        value={audio.ambientVolume}
        onChange={setAmbientVolume}
      />
      <VolumeRow
        label="Motor"
        value={audio.motorVolume}
        onChange={setMotorVolume}
      />
      <VolumeRow
        label="SFX"
        value={audio.sfxVolume}
        onChange={setSfxVolume}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

const SECTION_TITLE: React.CSSProperties = {
  color: '#c8873a',
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 14,
  marginTop: 0,
  fontWeight: 600,
};

const DIVIDER: React.CSSProperties = {
  borderTop: '1px solid #2a2a2a',
  margin: '10px 0 20px',
};

// ---------------------------------------------------------------------------
// Controls panel — WASD + interact rebinding
// ---------------------------------------------------------------------------

/** Human-readable label for each action */
const ACTION_LABELS: Record<KeyAction, string> = {
  forward:  'Move forward',
  back:     'Move back',
  left:     'Strafe left',
  right:    'Strafe right',
  interact: 'Interact (grab / place)',
};

function ControlsPanel(): React.ReactElement {
  const { controls, rebind, resetKeymap } = useSettingsStore();
  const { keymap } = controls;

  // The action currently awaiting a key press (capture mode)
  const [capturing, setCapturing] = useState<KeyAction | null>(null);
  // Transient feedback message (e.g. "Swapped forward ↔ back")
  const [notice, setNotice] = useState<string>('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for keydown during capture mode
  useEffect(() => {
    if (capturing === null) return;

    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      // Ignore modifier-only presses, Escape (cancel), and Enter
      if (e.key === 'Escape') { setCapturing(null); return; }
      if (e.key === 'Enter')  { setCapturing(null); return; }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const result = rebind(capturing, e.key);
      if (result === 'swapped') {
        // Find which action was displaced (to build the notice)
        const newKm = useSettingsStore.getState().controls.keymap;
        const swappedAction = KEY_ACTIONS.find((a) => a !== capturing && newKm[a] !== keymap[a]);
        const swappedLabel = swappedAction !== undefined ? ACTION_LABELS[swappedAction] : 'another action';
        setNotice(`Swapped ${ACTION_LABELS[capturing]} and ${swappedLabel}`);
      } else {
        setNotice('');
      }
      setCapturing(null);
      // Clear any previous timer
      if (noticeTimer.current !== null) clearTimeout(noticeTimer.current);
      if (result === 'swapped') {
        noticeTimer.current = setTimeout(() => { setNotice(''); }, 3000);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [capturing, rebind, keymap]);

  // ── Static (non-remappable) bindings shown for reference
  const STATIC_BINDINGS = [
    { label: 'Open settings',  key: 'Esc' },
  ];

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: '7px 10px',
    background: '#242424',
    borderRadius: 6,
    border: '1px solid #333',
  };

  const rowLabelStyle: React.CSSProperties = {
    color: '#bbb',
    fontSize: '0.87rem',
    flex: 1,
  };

  const keyBadgeStyle = (isCapturing: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '3px 10px',
    background: isCapturing ? '#c8873a' : '#333',
    color: isCapturing ? '#1a1a1a' : '#ddd',
    border: `1px solid ${isCapturing ? '#c8873a' : '#555'}`,
    borderRadius: 4,
    fontSize: '0.82rem',
    fontFamily: 'monospace',
    minWidth: 44,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'background 0.1s',
    letterSpacing: '0.02em',
  });

  const staticBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '3px 10px',
    background: '#1e1e1e',
    color: '#666',
    border: '1px solid #333',
    borderRadius: 4,
    fontSize: '0.82rem',
    fontFamily: 'monospace',
    minWidth: 44,
    textAlign: 'center',
    letterSpacing: '0.02em',
  };

  const resetBtnStyle: React.CSSProperties = {
    marginTop: 20,
    padding: '7px 16px',
    background: 'transparent',
    border: '1px solid #555',
    color: '#888',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
  };

  return (
    <div>
      <p style={SECTION_TITLE}>Movement &amp; interaction</p>

      {/* Remappable bindings */}
      {KEY_ACTIONS.map((action) => {
        const isCapturing = capturing === action;
        return (
          <div key={action} style={rowStyle}>
            <span style={rowLabelStyle}>{ACTION_LABELS[action]}</span>
            <button
              style={keyBadgeStyle(isCapturing)}
              onClick={() => { setCapturing(isCapturing ? null : action); }}
              aria-label={`Rebind ${ACTION_LABELS[action]}`}
              title={isCapturing ? 'Press any key — Esc to cancel' : 'Click to rebind'}
            >
              {isCapturing ? 'press a key…' : keymap[action].toUpperCase()}
            </button>
          </div>
        );
      })}

      <div style={DIVIDER} />

      <p style={{ ...SECTION_TITLE, marginTop: 0 }}>Fixed bindings</p>
      {STATIC_BINDINGS.map(({ label, key }) => (
        <div key={key} style={rowStyle}>
          <span style={rowLabelStyle}>{label}</span>
          <span style={staticBadgeStyle}>{key}</span>
        </div>
      ))}

      {/* Transient swap notice */}
      {notice !== '' && (
        <p style={{ color: '#c8873a', fontSize: '0.82rem', marginTop: 12 }}>
          {notice}
        </p>
      )}

      <button
        style={resetBtnStyle}
        onClick={resetKeymap}
      >
        Reset to defaults
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera & feel panel
// ---------------------------------------------------------------------------

function SensSlider({
  label,
  value,
  onChange,
  min = 0.25,
  max = 3.0,
  step = 0.05,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}): React.ReactElement {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  };
  const labelStyle: React.CSSProperties = {
    color: '#bbb',
    fontSize: '0.88rem',
    width: 160,
    flexShrink: 0,
  };
  const sliderStyle: React.CSSProperties = {
    flex: 1,
    accentColor: '#c8873a',
    cursor: 'pointer',
  };
  const valueStyle: React.CSSProperties = {
    color: '#888',
    fontSize: '0.82rem',
    width: 38,
    textAlign: 'right',
    flexShrink: 0,
  };

  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={sliderStyle}
        onChange={(e) => { onChange(parseFloat(e.target.value)); }}
      />
      <span style={valueStyle}>{value.toFixed(2)}x</span>
    </div>
  );
}

function CameraPanel(): React.ReactElement {
  const { camera, setLookSensitivity, setInvertY, setDialSensitivity } = useSettingsStore();

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: '7px 0',
  };
  const toggleLabelStyle: React.CSSProperties = {
    color: '#bbb',
    fontSize: '0.88rem',
  };
  const toggleBtnStyle: React.CSSProperties = {
    padding: '5px 14px',
    background: camera.invertY ? '#c8873a' : '#2a2a2a',
    color: camera.invertY ? '#1a1a1a' : '#bbb',
    border: '1px solid #c8873a',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    fontWeight: 600,
  };

  return (
    <div>
      <p style={SECTION_TITLE}>Mouse look</p>

      <SensSlider
        label="Look sensitivity"
        value={camera.lookSensitivity}
        onChange={setLookSensitivity}
      />

      <div style={toggleRowStyle}>
        <span style={toggleLabelStyle}>Invert Y axis</span>
        <button
          style={toggleBtnStyle}
          onClick={() => { setInvertY(!camera.invertY); }}
        >
          {camera.invertY ? 'On' : 'Off'}
        </button>
      </div>

      <div style={DIVIDER} />

      <p style={{ ...SECTION_TITLE, marginTop: 0 }}>Speed dial</p>

      <SensSlider
        label="Dial sensitivity"
        value={camera.dialSensitivity}
        onChange={setDialSensitivity}
      />

      <p style={{ color: '#555', fontSize: '0.80rem', marginTop: -8 }}>
        Higher = less drag needed for full RPM range.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SettingsMenu(): React.ReactElement | null {
  const { isOpen, close } = useSettingsStore();
  const [activeTab, setActiveTab] = React.useState<TabId>('audio');

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if the click landed directly on the backdrop, not inside the panel.
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close],
  );

  if (!isOpen) return null;

  return (
    <div style={BACKDROP} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Settings">
      <div style={PANEL}>
        {/* Header */}
        <div style={HEADER}>
          <h2 style={TITLE}>Settings</h2>
          <button
            style={CLOSE_BTN}
            onClick={close}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        {/* Body: tab list + content */}
        <div style={BODY}>
          {/* Tab list */}
          <nav style={TAB_LIST} aria-label="Settings categories">
            {TABS.map((tab) => (
              <TabButton
                key={tab.id}
                label={tab.label}
                active={activeTab === tab.id}
                onClick={() => { setActiveTab(tab.id); }}
              />
            ))}
          </nav>

          {/* Content */}
          <div style={CONTENT}>
            {activeTab === 'audio'    && <AudioPanel />}
            {activeTab === 'controls' && <ControlsPanel />}
            {activeTab === 'camera'   && <CameraPanel />}
            {activeTab !== 'audio' && activeTab !== 'controls' && activeTab !== 'camera' && (
              <p style={COMING_SOON}>
                {TABS.find((t) => t.id === activeTab)?.label} settings — coming soon.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
