import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-conversation-cards",
  description: "Random prompt-cards rotate the room. Fair-RNG draw, slot-based responder.",
  accentHex: "#d878ff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
