/**
 * RoomPropertiesPanel.test.tsx — the Room Editor knobs rail renders and drives
 * roomLayoutStore (plain HTML, no Canvas/WebGL needed).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RoomPropertiesPanel } from './RoomPropertiesPanel.js';
import { useRoomLayoutStore } from './roomLayoutStore.js';

beforeEach(() => {
  localStorage.clear();
  useRoomLayoutStore.setState({ layout: {} });
  cleanup();
});

describe('RoomPropertiesPanel — render + controls', () => {
  it('renders all controls with stable selectors for the active prop', () => {
    render(<RoomPropertiesPanel activeName="DemoBench" />);
    expect(screen.getByTestId('room-properties-panel').getAttribute('data-room-prop')).toBe(
      'DemoBench',
    );
    for (const id of [
      'room-position-x',
      'room-position-y',
      'room-position-z',
      'room-rotation-y',
      'room-scale-uniform',
      'room-scale-x',
      'room-copy-json',
      'room-download-layout',
    ]) {
      expect(screen.getByTestId(id)).not.toBeNull();
    }
  });

  it('position input updates only that axis in the store', () => {
    render(<RoomPropertiesPanel activeName="DemoBench" />);
    fireEvent.change(screen.getByTestId('room-position-x'), { target: { value: '1.5' } });
    expect(useRoomLayoutStore.getState().getPlacement('DemoBench').position).toEqual([1.5, 0, 0]);
  });

  it('uniform scale slider sets all three axes', () => {
    render(<RoomPropertiesPanel activeName="DemoBench" />);
    fireEvent.change(screen.getByTestId('room-scale-uniform'), { target: { value: '1.5' } });
    expect(useRoomLayoutStore.getState().getPlacement('DemoBench').scale).toEqual([1.5, 1.5, 1.5]);
  });

  it('Copy JSON copies a single-prop placement object', () => {
    const writeText = vi.fn<(t: string) => Promise<void>>().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });

    render(<RoomPropertiesPanel activeName="DemoBench" />);
    fireEvent.change(screen.getByTestId('room-rotation-y'), { target: { value: '45' } });
    fireEvent.click(screen.getByTestId('room-copy-json'));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = JSON.parse(writeText.mock.calls[0]?.[0] ?? '{}') as Record<
      string,
      { rotationDeg: number[] }
    >;
    expect(Object.keys(copied)).toEqual(['DemoBench']);
    expect(copied.DemoBench?.rotationDeg).toEqual([0, 45, 0]);
  });

  it('Reset returns the prop to identity', () => {
    render(<RoomPropertiesPanel activeName="DemoBench" />);
    fireEvent.change(screen.getByTestId('room-scale-uniform'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('room-reset-placement'));
    expect(useRoomLayoutStore.getState().diff()).toEqual({});
  });
});
