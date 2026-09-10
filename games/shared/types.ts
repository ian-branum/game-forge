import type React from "react";

export type TurnModel = "question-sequence" | "turn-based" | "phase-based" | "tick-based" | "real-time";
export type Interaction = "challenge" | "opposed" | "cooperative" | "narrative" | "sandbox" | "social";
export type RuntimeIntelligence = "none" | "scripted" | "search-based" | "simulation-based" | "generative" | "hybrid";
export type InformationModel = "perfect" | "partial" | "hidden";
export type PersistenceRequirement = "none" | "session" | "campaign";

export interface ClassificationProfile {
  interaction: Interaction;
  turnModel: TurnModel;
  runtimeIntelligence: RuntimeIntelligence;
  information: InformationModel;
  playerCount?: number;
  persistence?: PersistenceRequirement;
}

export interface ClassificationResult {
  gameType: string;
  profile: ClassificationProfile;
  confidence: number;
  assumptions: string[];
  clarificationNeeded?: string | null;
}

export interface GameTypeMeta {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  creditCost: number;
  schemaVersion: string;
  available: boolean;
  supportedProfiles: Partial<ClassificationProfile>[];
}

export interface ServerPlugin<T = unknown> {
  meta: GameTypeMeta;
  generate: (prompt: string) => Promise<T>;
  validate: (payload: unknown) => T;
  demo: T;
}

export interface PlayerPlugin<T = unknown> {
  id: string;
  Player: React.ComponentType<{ scenario: T }>;
}
