/**
 * 🛡️ ERROR BOUNDARY COMPONENT
 * Capture les erreurs React et affiche une UI de secours
 * Au lieu d'un écran blanc, l'utilisateur voit un message d'erreur friendly
 */

import React, { Component, type ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  name?: string; // Nom de la boundary pour identifier d'où vient l'erreur
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Mettre à jour le state pour afficher l'UI de secours
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Logger l'erreur
    console.error('❌ Error Boundary caught an error:', error, errorInfo);

    // Sauvegarder l'errorInfo dans le state
    this.setState({ errorInfo });

    // Logger dans un fichier via Electron
    if (window.electronAPI?.logError) {
      const errorLog = {
        message: error.message,
        stack: error.stack || '',
        componentStack: errorInfo.componentStack || '',
        timestamp: new Date().toISOString(),
        boundary: this.props.name || 'unnamed',
      };

      window.electronAPI.logError(errorLog).catch((err) => {
        console.error('Failed to log error to file:', err);
      });
    }

    // Callback personnalisé si fourni
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Utiliser le fallback personnalisé si fourni
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Sinon utiliser l'écran d'erreur par défaut
      return (
        <ErrorScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          boundaryName={this.props.name}
        />
      );
    }

    return this.props.children;
  }
}
