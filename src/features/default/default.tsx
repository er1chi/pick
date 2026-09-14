import { colors } from "@/theme";

export function Default() {
  return (
    <text fg={colors.muted}>
      No GitHub or Forgejo remote detected. Open Pick in a connected repository.
    </text>
  );
}
