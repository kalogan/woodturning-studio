/**
 * PropErrorBoundary — fail-soft per artifact (PREVIEW_HARNESS.md §B).
 *
 * One prop that throws during render (e.g. it needs a required prop the harness
 * doesn't supply) must NOT blank the whole gallery. We catch it, show an inline
 * error label, and let the director pick another prop. Keyed by prop name so a
 * fresh boundary is created on each selection (resets after a fix / switch).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Shown in the error label. */
  readonly name: string;
  readonly children: ReactNode;
  /** Bubble the message up so the HTML overlay (outside the Canvas) can show it. */
  readonly onError: (message: string | null) => void;
}

interface State {
  readonly message: string | null;
}

export class PropErrorBoundary extends Component<Props, State> {
  override state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    const message = error instanceof Error ? error.message : String(error);
    // High-signal console line for agent runtime smoke (§C).
    console.error(`[preview] prop "${this.props.name}" threw:`, message, info.componentStack);
    this.props.onError(message);
  }

  override render(): ReactNode {
    if (this.state.message !== null) {
      // Render nothing inside the Canvas; the HTML overlay reports the error.
      return null;
    }
    return this.props.children;
  }
}
