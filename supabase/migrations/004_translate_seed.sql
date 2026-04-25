-- ============================================
-- Translate seed data: Russian → English
-- Preserves IDs so all FKs (goal_problems, insight_cards) keep working.
-- ============================================

-- Backup
CREATE TABLE IF NOT EXISTS public._problems_ru_backup AS
  SELECT * FROM public.problems;
CREATE TABLE IF NOT EXISTS public._problem_categories_ru_backup AS
  SELECT * FROM public.problem_categories;

-- Categories
UPDATE public.problem_categories SET name = 'Technical'        WHERE id = 1;
UPDATE public.problem_categories SET name = 'Situations'       WHERE id = 2;
UPDATE public.problem_categories SET name = 'Decision Making'  WHERE id = 3;
UPDATE public.problem_categories SET name = 'Positioning'      WHERE id = 4;
UPDATE public.problem_categories SET name = 'Partnership'      WHERE id = 5;
UPDATE public.problem_categories SET name = 'Fitness'          WHERE id = 6;
UPDATE public.problem_categories SET name = 'Meta-skills'      WHERE id = 7;

-- Technical (1–23)
UPDATE public.problems SET name = 'Unsure smash — often miss high balls' WHERE id = 1;
UPDATE public.problems SET name = 'Backhand unstable — lose control under pressure' WHERE id = 2;
UPDATE public.problems SET name = 'Bandeja errors — ball goes off-target' WHERE id = 3;
UPDATE public.problems SET name = 'I give the opponent easy lobs' WHERE id = 4;
UPDATE public.problems SET name = 'Cannot handle low balls' WHERE id = 5;
UPDATE public.problems SET name = 'Late racket prep — weak shots' WHERE id = 6;
UPDATE public.problems SET name = 'Don''t bend my knees — lose balance' WHERE id = 7;
UPDATE public.problems SET name = 'Unstable serve — many double faults' WHERE id = 8;
UPDATE public.problems SET name = 'Imprecise volley — into net or out' WHERE id = 9;
UPDATE public.problems SET name = 'Cannot play chiquita — no way to escape pressure with a soft ball' WHERE id = 10;
UPDATE public.problems SET name = 'Cannot hit víbora — ball flies too high or out' WHERE id = 11;
UPDATE public.problems SET name = 'Hit víbora too hard — lose control and position' WHERE id = 12;
UPDATE public.problems SET name = 'Don''t know when to hit víbora vs bandeja' WHERE id = 13;
UPDATE public.problems SET name = 'Bandeja too high — gives opponent an easy ball' WHERE id = 14;
UPDATE public.problems SET name = 'Don''t finish the bandeja motion — weak shot' WHERE id = 15;
UPDATE public.problems SET name = 'Cannot hit bajada — don''t know how to attack the rebound from the back wall' WHERE id = 16;
UPDATE public.problems SET name = 'Drop shot fails — into the net or too long' WHERE id = 17;
UPDATE public.problems SET name = 'Topspin forehand — tennis habit hurting padel' WHERE id = 18;
UPDATE public.problems SET name = 'Cannot play off the side wall — lost when the ball comes from there' WHERE id = 19;
UPDATE public.problems SET name = 'No serve variation — opponent reads it and attacks the return' WHERE id = 20;
UPDATE public.problems SET name = 'Unstable return of serve — often gives an easy ball' WHERE id = 21;
UPDATE public.problems SET name = 'Cannot do a kick smash — all smashes flat, easily returned' WHERE id = 22;
UPDATE public.problems SET name = 'Powerful but inaccurate forehand — often miss the target' WHERE id = 23;

-- Situations (24–33)
UPDATE public.problems SET name = 'In attack I often hit the glass or net' WHERE id = 24;
UPDATE public.problems SET name = 'Hit too hard — lose control of the ball' WHERE id = 25;
UPDATE public.problems SET name = 'Don''t know what to do when the ball rebounds off the glass' WHERE id = 26;
UPDATE public.problems SET name = 'Don''t use the lob when under pressure' WHERE id = 27;
UPDATE public.problems SET name = 'After a bandeja I don''t return to the net — lose position' WHERE id = 28;
UPDATE public.problems SET name = 'Don''t coordinate with my partner — both go for the same ball or skip it' WHERE id = 29;
UPDATE public.problems SET name = 'Cannot hold the net when opponents lob' WHERE id = 30;
UPDATE public.problems SET name = 'Lost when opponents press us from attack' WHERE id = 31;
UPDATE public.problems SET name = 'No proper warm-up before a match — first games go badly' WHERE id = 32;
UPDATE public.problems SET name = 'Don''t recover between matches in a tournament — second match is always worse' WHERE id = 33;

-- Decision Making (34–47)
UPDATE public.problems SET name = 'Indecisive — attack now or wait?' WHERE id = 34;
UPDATE public.problems SET name = 'Try to finish the rally too early — make errors' WHERE id = 35;
UPDATE public.problems SET name = 'Read ball trajectory poorly — arrive late' WHERE id = 36;
UPDATE public.problems SET name = 'Don''t know how to switch from defense to attack' WHERE id = 37;
UPDATE public.problems SET name = 'Hit anywhere instead of picking a zone' WHERE id = 38;
UPDATE public.problems SET name = 'Cannot build long rallies — want to finish too early' WHERE id = 39;
UPDATE public.problems SET name = 'Don''t use the score — play the same at 40-0 and 0-40' WHERE id = 40;
UPDATE public.problems SET name = 'Don''t know how to play a pair that always stays back' WHERE id = 41;
UPDATE public.problems SET name = 'Play the same all match — don''t adapt when something stops working' WHERE id = 42;
UPDATE public.problems SET name = 'Cannot exploit the opponent''s weaker side' WHERE id = 43;
UPDATE public.problems SET name = 'Cannot slow the tempo when needed — always one rhythm' WHERE id = 44;
UPDATE public.problems SET name = 'Hit the middle too often — easy for the opponent to answer' WHERE id = 45;
UPDATE public.problems SET name = 'Don''t use diagonal balls — play too straight' WHERE id = 46;
UPDATE public.problems SET name = 'Drop shot at the wrong moment — lose the point' WHERE id = 47;

-- Positioning (48–60)
UPDATE public.problems SET name = 'Stand too far back and don''t reach the ball' WHERE id = 48;
UPDATE public.problems SET name = 'Don''t come up to the net when I should attack' WHERE id = 49;
UPDATE public.problems SET name = 'Don''t know where to stand after my shot' WHERE id = 50;
UPDATE public.problems SET name = 'Don''t move in sync with my partner — open up zones' WHERE id = 51;
UPDATE public.problems SET name = 'Stand too close to the net — too late on lobs' WHERE id = 52;
UPDATE public.problems SET name = 'Lose position after a hard shot — cannot recover' WHERE id = 53;
UPDATE public.problems SET name = 'Cannot move backwards sideways — run with my back, lose control' WHERE id = 54;
UPDATE public.problems SET name = 'Slow to react to fast balls at the net' WHERE id = 55;
UPDATE public.problems SET name = 'Don''t reach my position after switching sides with my partner' WHERE id = 56;
UPDATE public.problems SET name = 'Footwork is poor — stand still instead of moving toward the ball' WHERE id = 57;
UPDATE public.problems SET name = 'Cannot do quick lateral steps — lose down-the-line balls' WHERE id = 58;
UPDATE public.problems SET name = 'Don''t recover to center position after a shot' WHERE id = 59;
UPDATE public.problems SET name = 'Cannot share middle balls properly with my partner' WHERE id = 60;

-- Partnership (61–65)
UPDATE public.problems SET name = 'Dependent on my partner — when they play badly I fall apart too' WHERE id = 61;
UPDATE public.problems SET name = 'Cannot encourage my partner verbally — silent when help is needed' WHERE id = 62;
UPDATE public.problems SET name = 'Conflict with my partner mid-match — hurts both of us' WHERE id = 63;
UPDATE public.problems SET name = 'We both go for too many balls — don''t trust each other' WHERE id = 64;
UPDATE public.problems SET name = 'Cannot play with an unfamiliar partner — lost in the first games' WHERE id = 65;

-- Fitness (66–70)
UPDATE public.problems SET name = 'Tire quickly — play worse by the end of the match' WHERE id = 66;
UPDATE public.problems SET name = 'Lose explosive speed quickly — slower by mid-match' WHERE id = 67;
UPDATE public.problems SET name = 'Not enough arm strength by the third set — shots get weaker' WHERE id = 68;
UPDATE public.problems SET name = 'Get injured from poor movement — knees, elbow, shoulder' WHERE id = 69;
UPDATE public.problems SET name = 'Cannot breathe properly during play — out of breath in long rallies' WHERE id = 70;

-- Meta-skills (71–84)
UPDATE public.problems SET name = 'Lose focus after a string of errors' WHERE id = 71;
UPDATE public.problems SET name = 'Get nervous in big moments — game falls apart' WHERE id = 72;
UPDATE public.problems SET name = 'Get angry at myself or my partner — hurts the game' WHERE id = 73;
UPDATE public.problems SET name = 'Everything works in practice, nothing in matches' WHERE id = 74;
UPDATE public.problems SET name = 'Cannot recover after losing a set' WHERE id = 75;
UPDATE public.problems SET name = 'Cannot read the opponent''s weaknesses and exploit them' WHERE id = 76;
UPDATE public.problems SET name = 'Afraid of tournaments — fine in practice, lost at competition' WHERE id = 77;
UPDATE public.problems SET name = 'Cannot reset between points — carry emotion through the match' WHERE id = 78;
UPDATE public.problems SET name = 'Get upset when I lose a set — give up internally' WHERE id = 79;
UPDATE public.problems SET name = 'Cannot play under score pressure — fall apart at tiebreak' WHERE id = 80;
UPDATE public.problems SET name = 'Don''t trust my game — doubt every shot' WHERE id = 81;
UPDATE public.problems SET name = 'Cannot play different opponent types — lost against defenders' WHERE id = 82;
UPDATE public.problems SET name = 'Cannot change rhythm — opponent adapts easily' WHERE id = 83;
UPDATE public.problems SET name = 'Cannot create pressure with deep balls' WHERE id = 84;
