import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { AbstractStrategyScenario } from "./schema";
import AbstractStrategyGameComponent from "./AbstractStrategyGame";

export const abstractStrategyPlayer: PlayerPlugin<AbstractStrategyScenario> = {
  id: "abstract-strategy",
  Player: AbstractStrategyGameComponent as unknown as React.ComponentType<{ scenario: AbstractStrategyScenario }>,
};
