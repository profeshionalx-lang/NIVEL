import { PADEL_GLOSSARY } from './glossary';
import { WHISPER_HALLUCINATIONS } from './hallucinations';

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
}

export interface WhisperVerboseJson {
  task?: string;
  language?: string;
  duration?: number;
  text: string;
  segments: WhisperSegment[];
}

export interface ProcessedSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

function applyGlossary(text: string): string {
  let result = text;
  for (const [pattern, canonical] of PADEL_GLOSSARY) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, canonical);
  }
  return result;
}

function removeHallucinations(text: string): string {
  let result = text;
  for (const pattern of WHISPER_HALLUCINATIONS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, '');
  }
  // Collapse multiple spaces left by removals
  return result.replace(/\s{2,}/g, ' ').trim();
}

function cleanText(text: string): string {
  return removeHallucinations(applyGlossary(text));
}

export function postprocessTranscript(verboseJson: WhisperVerboseJson): {
  raw_text: string;
  segments: ProcessedSegment[];
} {
  const segments: ProcessedSegment[] = verboseJson.segments.map((seg) => ({
    id: seg.id,
    start: seg.start,
    end: seg.end,
    text: cleanText(seg.text),
  }));

  const raw_text = cleanText(verboseJson.text);

  return { raw_text, segments };
}
