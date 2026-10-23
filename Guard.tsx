import { Component, type ReactNode } from "react";

/** If a navigation/decoration part crashes, the rest of the page keeps working (the crash is logged to the browser console). */
export class Guard extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(`[${this.props.name}] crashed:`, error); }
  render() { return this.state.failed ? null : this.props.children; }
}
