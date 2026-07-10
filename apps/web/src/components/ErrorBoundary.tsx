import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorPage from './ErrorPage';
import { reportClientError } from '../lib/reportError';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error.message, error.stack ?? info.componentStack ?? undefined, 'error_boundary');
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage variant="500" onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
