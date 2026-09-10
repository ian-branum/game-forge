import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { NarrativeScenario } from "./schema";
import NarrativeGameComponent from "./NarrativeGame";

export const narrativePlayer: PlayerPlugin<NarrativeScenario> = {
  id: "narrative",
  Player: NarrativeGameComponent as unknown as React.ComponentType<{ scenario: NarrativeScenario }>,
};
