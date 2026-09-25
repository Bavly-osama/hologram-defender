export interface ScoreInput {
  playerName: string;
  score: number;
  wave: number;
  coreIntegrity: number;
  accuracy: number;
  duration: number;
}
export const scoreSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "playerName",
    "score",
    "wave",
    "coreIntegrity",
    "accuracy",
    "duration",
  ],
  properties: {
    playerName: {
      type: "string",
      minLength: 1,
      maxLength: 20,
      pattern: "^[A-Za-z0-9][A-Za-z0-9 _.-]*$",
    },
    score: { type: "integer", minimum: 0, maximum: 250000 },
    wave: { type: "integer", minimum: 1, maximum: 5 },
    coreIntegrity: { type: "number", minimum: 0, maximum: 100 },
    accuracy: { type: "number", minimum: 0, maximum: 1 },
    duration: { type: "integer", minimum: 1, maximum: 7200 },
  },
};
