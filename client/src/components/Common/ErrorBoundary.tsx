import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-10 text-center">
            <h2 className="mb-3 text-xl font-bold">Une erreur est survenue</h2>
            <p className="text-text-muted mb-5 text-sm">{this.state.error?.message || 'Erreur inattendue'}</p>
            <button
              className="bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans"
              onClick={() => window.location.reload()}
              aria-label="Recharger la page"
            >
              Recharger la page
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
