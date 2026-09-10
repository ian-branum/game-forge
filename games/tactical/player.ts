import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { ScenarioDefinition } from "./engine/types";
import TacticalGameComponent from "./TacticalGame";

export const tacticalPlayer: PlayerPlugin<ScenarioDefinition> = {
  id: "tactical",
  Player: TacticalGameComponent as unknown as React.ComponentType<{ scenario: ScenarioDefinition }>,
};
