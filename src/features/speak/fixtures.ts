import { ANALYZE_PROMPT, type AnalyzeResponse } from '../../ai/contracts.generated';

/** The three worked examples from prompts/analyze.md (they are real model-shaped outputs). */
export const analyzeExamples: { input: { transcript: string; context: string }; output: AnalyzeResponse }[] = (() => {
  const blocks = [...ANALYZE_PROMPT.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  const out: { input: { transcript: string; context: string }; output: AnalyzeResponse }[] = [];
  for (let i = 0; i + 1 < blocks.length; i += 2) out.push({ input: blocks[i], output: blocks[i + 1] });
  return out;
})();
