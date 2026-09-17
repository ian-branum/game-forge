import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { SandboxScenario } from "./schema";
import SandboxGame from "./SandboxGame";

export const sandboxPlayer: PlayerPlugin<SandboxScenario> = {
  id: "sandbox",
  Player: SandboxGame as unknown as React.ComponentType<{ scenario: SandboxScenario }>,
};
