import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    console.error('ErrorBoundary caught error:', error);
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('Error details:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" style={{ maxWidth: 560, margin: '15vh auto', padding: 24, fontFamily: 'system-ui', color: '#172554' }}>
          <h1>We couldn't load this screen</h1>
          <p>Please reload the CRM to try again. If this keeps happening, contact your administrator.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 20px', cursor: 'pointer', borderRadius: 8, border: 0, background: '#1d4ed8', color: 'white' }}>
            Reload CRM
          </button>
          {import.meta.env.DEV && <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>}
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
} else {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Root element not found!</div>';
}
