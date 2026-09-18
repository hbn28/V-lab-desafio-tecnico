import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ color: '#991b1b' }}>Ocorreu um erro inesperado</h2>
          <p style={{ color: '#475569' }}>
            Recarregue a página. Se o problema persistir, verifique o console do navegador (F12).
          </p>
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', color: '#64748b' }}>Detalhes do erro</summary>
            <pre style={{ marginTop: '0.5rem', padding: '1rem', background: '#f1f5f9', borderRadius: '0.5rem', fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
