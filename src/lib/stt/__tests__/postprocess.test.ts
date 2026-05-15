import { describe, it, expect } from 'vitest';
import { postprocessTranscript, WhisperVerboseJson } from '../postprocess';

function makeInput(text: string, segmentText?: string): WhisperVerboseJson {
  return {
    text,
    segments: [
      {
        id: 0,
        start: 0,
        end: 5,
        text: segmentText ?? text,
      },
    ],
  };
}

describe('postprocessTranscript', () => {
  it('removes "Субтитры сделал DimaTorzok" hallucination', () => {
    const input = makeInput('Сыграй бандеху. Субтитры сделал DimaTorzok');
    const { raw_text, segments } = postprocessTranscript(input);
    expect(raw_text).not.toContain('DimaTorzok');
    expect(raw_text).not.toContain('Субтитры сделал');
    expect(segments[0].text).not.toContain('DimaTorzok');
  });

  it('replaces "бомбеху" with "бандеха" (canonical padel term)', () => {
    const input = makeInput('Надо сыграть бомбеху здесь.');
    const { raw_text, segments } = postprocessTranscript(input);
    // Glossary replaces misheard form with canonical nominative "бандеха"
    expect(raw_text).toContain('бандеха');
    expect(raw_text).not.toContain('бомбеху');
    expect(segments[0].text).toContain('бандеха');
  });

  it('replaces "версора" with "вибора"', () => {
    const input = makeInput('Он использовал версору в этом розыгрыше.');
    const { raw_text, segments } = postprocessTranscript(input);
    expect(raw_text).toContain('вибора');
    expect(raw_text).not.toContain('версору');
    expect(segments[0].text).toContain('вибора');
  });

  it('is idempotent — running twice gives the same result', () => {
    const input = makeInput('Бомбеху или версора? Субтитры сделал DimaTorzok');
    const first = postprocessTranscript(input);
    const second = postprocessTranscript({
      text: first.raw_text,
      segments: first.segments.map((s) => ({ ...s })),
    });
    expect(second.raw_text).toBe(first.raw_text);
    expect(second.segments[0].text).toBe(first.segments[0].text);
  });

  it('replaces "прямате" with "ремате"', () => {
    const input = makeInput('Закончи атаку прямате.');
    const { raw_text } = postprocessTranscript(input);
    expect(raw_text).toContain('ремате');
    expect(raw_text).not.toContain('прямате');
  });

  it('replaces "глобов" with "глоба"', () => {
    const input = makeInput('Сыграй глобов назад.');
    const { raw_text } = postprocessTranscript(input);
    expect(raw_text).toContain('глоба');
    expect(raw_text).not.toContain('глобов');
  });

  it('preserves segment timing metadata', () => {
    const input: WhisperVerboseJson = {
      text: 'тест',
      segments: [{ id: 3, start: 12.5, end: 15.0, text: 'тест' }],
    };
    const { segments } = postprocessTranscript(input);
    expect(segments[0].id).toBe(3);
    expect(segments[0].start).toBe(12.5);
    expect(segments[0].end).toBe(15.0);
  });
});
