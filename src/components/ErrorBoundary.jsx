import React from 'react';
export default class ErrorBoundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="center-screen"><div className="glass setup-card"><h1>Something went wrong</h1>
      <p className="muted">{String(this.state.err?.message || this.state.err)}</p>
      <button className="btn primary" onClick={() => { this.setState({ err: null }); window.location.hash = '#/'; }}>Back to home</button></div></div>;
  }
}
