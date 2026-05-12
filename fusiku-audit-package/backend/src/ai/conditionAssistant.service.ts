/**
 * AI Condition Assistant - Suggests device grade from condition notes
 * Keywords and device specs inform grade suggestion
 */
export type DeviceGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

const GRADE_KEYWORDS: Record<DeviceGrade, string[]> = {
  'A+': ['mint', 'like new', 'perfect', 'flawless', 'pristine', 'unused', 'sealed'],
  'A': ['excellent', 'very good', 'minor', 'scratch-free', 'clean', 'good condition'],
  'B': ['good', 'light wear', 'small scratch', 'minor scratch', 'normal wear', 'acceptable'],
  'C': ['fair', 'moderate', 'scratches', 'wear', 'cosmetic', 'dents', 'chips'],
  'D': ['poor', 'heavy', 'cracked', 'broken', 'damaged', 'not working', 'parts only']
};

export const conditionAssistantService = {
  suggestGrade(conditionNotes: string): { grade: DeviceGrade; confidence: number; matchedKeywords: string[] } {
    const notes = conditionNotes.toLowerCase();
    const scores: Record<DeviceGrade, number> = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0 };

    for (const [grade, keywords] of Object.entries(GRADE_KEYWORDS)) {
      for (const kw of keywords) {
        if (notes.includes(kw)) {
          scores[grade as DeviceGrade]++;
        }
      }
    }

    let bestGrade: DeviceGrade = 'B';
    let bestScore = 0;

    for (const [grade, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestGrade = grade as DeviceGrade;
      }
    }

    const totalMatches = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalMatches > 0 ? Math.min(0.95, 0.5 + bestScore * 0.15) : 0.4;
    const matchedKeywords = GRADE_KEYWORDS[bestGrade].filter((kw) => notes.includes(kw));

    return { grade: bestGrade, confidence, matchedKeywords };
  }
};
