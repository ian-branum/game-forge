import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { TriviaScenario } from "./schema";
import TriviaGameComponent from "./TriviaGame";

export const triviaPlayer: PlayerPlugin<TriviaScenario> = {
  id: "trivia",
  Player: TriviaGameComponent as unknown as React.ComponentType<{ scenario: TriviaScenario }>,
};
