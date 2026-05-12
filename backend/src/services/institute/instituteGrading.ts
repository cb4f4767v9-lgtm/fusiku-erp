/**
 * Grading helper — calculates percentage, grade letter, GPA, and pass/fail.
 * Designed to be replaceable per-tenant in the future (grading scale config).
 */

export type GradeResult = {
  percentage: number;
  grade: string;
  gpa: number;
  status: 'pass' | 'fail';
};

const DEFAULT_SCALE: { min: number; grade: string; gpa: number }[] = [
  { min: 90, grade: 'A+', gpa: 4.0 },
  { min: 85, grade: 'A', gpa: 3.75 },
  { min: 80, grade: 'A-', gpa: 3.5 },
  { min: 75, grade: 'B+', gpa: 3.25 },
  { min: 70, grade: 'B', gpa: 3.0 },
  { min: 65, grade: 'B-', gpa: 2.75 },
  { min: 60, grade: 'C+', gpa: 2.5 },
  { min: 55, grade: 'C', gpa: 2.25 },
  { min: 50, grade: 'C-', gpa: 2.0 },
  { min: 45, grade: 'D', gpa: 1.5 },
  { min: 0, grade: 'F', gpa: 0.0 },
];

export function calculateGrade(
  obtainedMarks: number,
  totalMarks: number,
  passingMarks: number
): GradeResult {
  if (totalMarks <= 0) {
    return { percentage: 0, grade: 'F', gpa: 0, status: 'fail' };
  }

  const percentage = Math.round((obtainedMarks / totalMarks) * 10000) / 100;
  const status = obtainedMarks >= passingMarks ? 'pass' : 'fail';

  let grade = 'F';
  let gpa = 0;
  for (const entry of DEFAULT_SCALE) {
    if (percentage >= entry.min) {
      grade = entry.grade;
      gpa = entry.gpa;
      break;
    }
  }

  if (status === 'fail') {
    grade = 'F';
    gpa = 0;
  }

  return { percentage, grade, gpa, status };
}

export function calculateWeightedGpa(
  results: { gpa: number; weightPercent: number | null }[]
): number | null {
  if (results.length === 0) return null;

  const hasWeights = results.some((r) => r.weightPercent !== null && r.weightPercent > 0);

  if (hasWeights) {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const r of results) {
      const w = r.weightPercent ?? 0;
      weightedSum += r.gpa * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null;
  }

  const sum = results.reduce((acc, r) => acc + r.gpa, 0);
  return Math.round((sum / results.length) * 100) / 100;
}
