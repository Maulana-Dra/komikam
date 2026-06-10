import React from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/app-text";
import { appendCrashLog } from "@/src/utils/crashLogger";

type CrashBoundaryState = {
  error: Error | null;
};

export class CrashBoundary extends React.Component<
  { children: React.ReactNode },
  CrashBoundaryState
> {
  state: CrashBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): CrashBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    appendCrashLog("react-error-boundary", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0B0B0E",
          justifyContent: "center",
          padding: 24,
          gap: 12,
        }}
      >
        <Text style={{ color: "#F2F2F7", fontSize: 20, fontWeight: "900" }}>
          Aplikasi mengalami error.
        </Text>
        <Text style={{ color: "#B3B3C2" }}>
          Detail error sudah disimpan ke Log Error di tab Akun.
        </Text>
        <Pressable
          onPress={() => this.setState({ error: null })}
          style={{
            alignSelf: "flex-start",
            backgroundColor: "#F2F2F7",
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#0B0B0E", fontWeight: "900" }}>
            Coba lagi
          </Text>
        </Pressable>
      </View>
    );
  }
}
