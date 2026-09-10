import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { SolitaireScenario } from "./schema";
import CardGameComponent from "./CardGame";

export const cardPlayer: PlayerPlugin<SolitaireScenario> = {
  id: "card",
  Player: CardGameComponent as unknown as React.ComponentType<{ scenario: SolitaireScenario }>,
};
