import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          color: '#E8E8E8',
          background: '#0A0C12',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '20px', margin: '0 0 8px', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 16px', opacity: 0.8, maxWidth: 480 }}>
            The Command Center hit an unexpected error. Try reloading the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #C9A84C',
              background: 'transparent',
              color: '#C9A84C',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
