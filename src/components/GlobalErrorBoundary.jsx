/* eslint-disable no-undef */
import React, { Component } from 'react';
import RobotLogo from './RobotLogo';
import CyberBorder from './CyberBorder';
import { logError } from '../api/AuthApi';

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'UI_CRASH', // 'UI_CRASH' or 'API_FATAL'
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorType: 'UI_CRASH' };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service here
    console.error('Critical System Failure:', error, errorInfo);

    logError({
      message: error?.message || 'UI Crash',
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      errorType: 'UI_CRASH',
    });
  }

  componentDidMount() {
    // Catch unhandled promise rejections (Unhandled API Errors)
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  handlePromiseRejection = (event) => {
    console.error('Unhandled API Rejection:', event.reason);
    const error = event.reason;

    this.setState({
      hasError: true,
      error: error,
      errorType: 'API_FATAL',
    });

    logError({
      message: error?.message || 'Unhandled Promise Rejection',
      stack: error?.stack,
      errorType: 'API_FATAL',
    });
  };

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard'; // Force clean state
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900 p-4">
          <CyberBorder signal="SELL" className="max-w-2xl w-full">
            <div className="p-10 text-center flex flex-col items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse"></div>
                <RobotLogo isConnected={false} size={120} />
              </div>

              <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                System Kernel Panic
              </h1>

              <div className="bg-black/40 border border-red-500/30 p-4 rounded-xl w-full text-left font-mono text-xs text-red-400 overflow-auto max-h-40 shadow-inner">
                <p className="font-bold mb-2">[{this.state.errorType}] Exception Details:</p>
                <p>{this.state.error?.message || 'Unknown internal error'}</p>
                {this.state.error?.stack && (
                  <pre className="mt-2 opacity-50 whitespace-pre-wrap">
                    {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                  </pre>
                )}
              </div>

              <p className="text-gray-400 text-sm">
                The ByteCafe neural link has been severed. Automated failsafes have engaged.
              </p>

              <button
                onClick={handleRecover}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95"
              >
                Reboot Terminal
              </button>
            </div>
          </CyberBorder>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
