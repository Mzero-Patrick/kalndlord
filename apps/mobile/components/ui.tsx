import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, useColorScheme, View, type TextInputProps } from "react-native";

export function usePalette() {
  const dark = useColorScheme() === "dark";
  return dark
    ? { bg: "#0e1418", surface: "#161e24", text: "#e8edf1", muted: "#9aa8b4", border: "#2a3640", brand: "#2dd4bf", brandText: "#062a26", danger: "#f97066", ok: "#47cd89" }
    : { bg: "#f6f7f9", surface: "#ffffff", text: "#16202a", muted: "#5b6875", border: "#dde2e8", brand: "#0f766e", brandText: "#ffffff", danger: "#b42318", ok: "#067647" };
}

export function Title({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  return <Text style={[styles.title, { color: c.text }]}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  return <Text style={{ color: c.muted }}>{children}</Text>;
}

export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const c = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      {hint ? <Text style={{ color: c.muted, fontSize: 13 }}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor={c.muted}
        style={[styles.input, { color: c.text, borderColor: error ? c.danger : c.border, backgroundColor: c.bg }]}
        {...props}
      />
      {error ? <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, busy, secondary }: { title: string; onPress: () => void; busy?: boolean; secondary?: boolean }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.button, { borderColor: c.brand, backgroundColor: secondary ? "transparent" : c.brand, opacity: busy ? 0.6 : 1 }]}
    >
      {busy ? <ActivityIndicator color={secondary ? c.brand : c.brandText} /> : (
        <Text style={{ color: secondary ? c.brand : c.brandText, fontWeight: "600", fontSize: 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Banner({ text, kind = "error" }: { text?: string; kind?: "error" | "ok" }) {
  const c = usePalette();
  if (!text) return null;
  const color = kind === "error" ? c.danger : c.ok;
  return <Text style={[styles.banner, { color, borderColor: color }]}>{text}</Text>;
}

export function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  const c = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: c.muted }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 26, fontWeight: "700" }}>{value}</Text>
      {hint ? <Text style={{ color: c.muted, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  field: { gap: 4 },
  label: { fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  banner: { borderWidth: 1, borderRadius: 8, padding: 10 },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 2 },
});

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, gap: 10 }]}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>{title}</Text>
      {children}
    </View>
  );
}

export function Body({ children, muted, bold }: { children: React.ReactNode; muted?: boolean; bold?: boolean }) {
  const c = usePalette();
  return <Text style={{ color: muted ? c.muted : c.text, fontWeight: bold ? "600" : "400" }}>{children}</Text>;
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? c.brand : c.border }}
    >
      <Text style={{ color: active ? c.brand : c.text }}>{label}</Text>
    </Pressable>
  );
}

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "muted"> = {
  AVAILABLE: "ok", ACCEPTED: "ok", ACTIVE: "ok", PENDING: "warn", OCCUPIED: "warn", REJECTED: "danger",
};

export function StatusText({ status }: { status: string }) {
  const c = usePalette();
  const tone = STATUS_TONE[status] ?? "muted";
  const color = tone === "ok" ? c.ok : tone === "danger" ? c.danger : tone === "warn" ? "#b54708" : c.muted;
  return <Text style={{ color, fontWeight: "600" }}>{status.charAt(0) + status.slice(1).toLowerCase()}</Text>;
}
