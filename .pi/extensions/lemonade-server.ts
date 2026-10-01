export default function (pi) {
  pi.registerProvider("lemonade-server", {
    baseUrl: "http://100.108.123.126:13305/v1",
    api: "openai-completions",
    apiKey: "lemonade",
    compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
    models: [
      {
        id: "Qwen3.6-35B-A3B",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 16000,
      },
      {
        id: "Qwen3.8-27B",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 16000,
      },
    ],
  });
}
