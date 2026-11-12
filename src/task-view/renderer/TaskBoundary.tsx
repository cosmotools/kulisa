// React failure containment for one retained screen (docs/window.md, Task rendering failures).
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@ui';
import { forgetFrozen } from './views';
import { store } from './state';

export class TaskBoundary extends Component<{ failed: boolean; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown, info: ErrorInfo) {
    const { key, active } = store.getState();
    if (active) forgetFrozen();
    store.setState({ loading: false, pictures: {} });
    // Error properties can contain private content or throw themselves; only inspect the value's JavaScript type.
    void kulisa.invoke('task:view-failed', { task: key, kind: error === null ? 'null' : typeof error,
      frames: (info.componentStack ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8) });
  }
  override render() {
    if (!this.state.failed && !this.props.failed) return this.props.children;
    return <Empty role="alert" className="h-full"><EmptyHeader>
      <EmptyTitle>This task’s screen could not be displayed</EmptyTitle>
      <EmptyDescription>Your task stays open and running work continues. You can switch to another task or close this task from its tab.</EmptyDescription>
    </EmptyHeader></Empty>;
  }
}
