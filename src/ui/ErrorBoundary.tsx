// If something goes wrong on a screen, show what happened (and a way to try again) instead of
// letting the whole app close.
import React from 'react';
import { View } from 'react-native';
import { C } from '../theme';
import { Box, PButton, T } from './kit';

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<{ name: string; children: React.ReactNode; onReset?: () => void }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
        <Box bg={C.cream} pad={14}>
          <T px size={11}>OOPS</T>
          <T size={24} style={{ marginTop: 8 }}>The {this.props.name} screen hit a problem.</T>
          <T size={19} color={C.inkSoft} style={{ marginTop: 6 }}>{String(this.state.error.message || this.state.error).slice(0, 240)}</T>
          <PButton label="TRY AGAIN" style={{ marginTop: 14 }} onPress={() => { this.setState({ error: null }); this.props.onReset?.(); }} />
        </Box>
      </View>
    );
  }
}
