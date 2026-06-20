/**
 * PropertiesPanel.test.tsx — the knobs rail renders and drives the edit store.
 *
 * Mounts the REAL panel in jsdom (no Canvas/WebGL needed — it's plain HTML) and
 * exercises the live controls + export, proving the dual-consumer selectors work
 * and that edits flow into editStore + the exported JSON shape.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PropertiesPanel } from './PropertiesPanel.js';
import { useEditStore } from './editStore.js';

beforeEach(() => {
  localStorage.clear();
  useEditStore.setState({ edits: {} });
  cleanup();
});

describe('PropertiesPanel — render + controls', () => {
  it('renders all controls with stable selectors for the active prop', () => {
    render(<PropertiesPanel activeName="Workbench" />);
    expect(screen.getByTestId('properties-panel').getAttribute('data-prop')).toBe('Workbench');
    for (const id of [
      'edit-scale-uniform',
      'edit-scale-x',
      'edit-position-y',
      'edit-rotation-z',
      'edit-tint-enabled',
      'edit-tint-color',
      'copy-json',
      'download-edits',
    ]) {
      expect(screen.getByTestId(id)).not.toBeNull();
    }
  });

  it('uniform scale slider sets all three axes in the store', () => {
    render(<PropertiesPanel activeName="Workbench" />);
    fireEvent.change(screen.getByTestId('edit-scale-uniform'), { target: { value: '1.5' } });
    expect(useEditStore.getState().getEdit('Workbench').scale).toEqual([1.5, 1.5, 1.5]);
  });

  it('per-axis scale input updates only that axis', () => {
    render(<PropertiesPanel activeName="Workbench" />);
    fireEvent.change(screen.getByTestId('edit-scale-x'), { target: { value: '2' } });
    expect(useEditStore.getState().getEdit('Workbench').scale).toEqual([2, 1, 1]);
  });

  it('tint checkbox toggles the override and colour input enables', () => {
    render(<PropertiesPanel activeName="Workbench" />);
    const check = screen.getByTestId('edit-tint-enabled');
    expect(useEditStore.getState().getEdit('Workbench').tint).toBeNull();
    fireEvent.click(check);
    expect(useEditStore.getState().getEdit('Workbench').tint).toBe('#a87f4d');
    fireEvent.click(check);
    expect(useEditStore.getState().getEdit('Workbench').tint).toBeNull();
  });

  it('Copy JSON copies a single-prop object', () => {
    const writeText = vi.fn<(t: string) => Promise<void>>().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });

    render(<PropertiesPanel activeName="Workbench" />);
    fireEvent.change(screen.getByTestId('edit-rotation-y'), { target: { value: '15' } });
    fireEvent.click(screen.getByTestId('copy-json'));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = JSON.parse(writeText.mock.calls[0]?.[0] ?? '{}') as Record<
      string,
      { rotationDeg: number[] }
    >;
    expect(Object.keys(copied)).toEqual(['Workbench']);
    expect(copied.Workbench?.rotationDeg).toEqual([0, 15, 0]);
  });

  it('Reset returns the prop to identity', () => {
    render(<PropertiesPanel activeName="Workbench" />);
    fireEvent.change(screen.getByTestId('edit-scale-uniform'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('reset-edit'));
    expect(useEditStore.getState().diff()).toEqual({});
  });
});
