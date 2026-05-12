// Flat i18n dictionary. Keys are stable; values change per locale.
// Add new keys as new UI strings appear. Default locale is RU.

const ru = {
  // Common / shared
  "common.create": "Создать",
  "common.save": "Сохранить",
  "common.cancel": "Отмена",
  "common.delete": "Удалить",
  "common.edit": "Редактировать",
  "common.back": "Назад",
  "common.next": "Далее",
  "common.skip": "Пропустить",
  "common.take": "Взять",
  "common.search": "Поиск",
  "common.loading": "Загрузка…",
  "common.more": "ещё",
  "common.new": "Новое",
  "common.done": "Готово",
  "common.actionRequired": "Требуется действие",
  "common.completed": "Завершено",
  "common.upcoming": "Скоро",
  "common.items": "элементов",

  // Auth / login
  "login.title": "Войти в Nivel",
  "login.subtitle": "Падел-платформа для тренеров и игроков",
  "login.viaGrechka": "Войти через Гречка",
  "login.viaGoogle": "Войти через Google",
  "login.error": "Не удалось войти. Попробуйте ещё раз.",

  // Nav
  "nav.home": "Главная",
  "nav.insights": "Карточки",
  "nav.matches": "Матчи",
  "nav.logout": "Выйти",

  // Dashboard
  "dashboard.welcome": "Добро пожаловать,",
  "dashboard.player": "Игрок",
  "dashboard.emptyHint":
    "Начните с создания первой цели — выберите проблемы, над которыми хотите работать.",
  "dashboard.createGoal": "Создать цель",
  "dashboard.insightsToReview": "новых карточек на разбор",
  "dashboard.insightsToReview.one": "новая карточка на разбор",
  "dashboard.fromSession": "По сессии",
  "dashboard.andMore": "и ещё",
  "dashboard.masterPlan": "Мастер-план",
  "dashboard.moreSections": "ещё разделов",
  "dashboard.currentPlan": "Текущий план",
  "dashboard.activeGoals": "Активные цели",
  "dashboard.sessions": "сессий",
  "dashboard.skillProgression": "Прогресс навыков",
  "dashboard.sessionHistory": "История сессий",
  "dashboard.session": "Сессия",
  "dashboard.nextSession": "Следующая сессия",
  "dashboard.exercises": "Упражнения",

  // Insights / vault
  "insights.title": "Карточки разборов",
  "insights.empty": "Пока нет карточек. Они появятся после сессий с тренером.",
  "insights.filterAll": "Все",
  "insights.take": "Взять",
  "insights.skip": "Пропустить",
  "insights.skipped": "Пропущенные",
  "insights.allReviewed": "Все карточки разобраны 🎉",
  "insights.swipeHint": "Свайпните влево, чтобы пропустить, вправо — чтобы взять",
  "insights.category": "Категория",

  // Trainer
  "trainer.students": "Ученики",
  "trainer.library": "Библиотека",
  "trainer.addStudent": "Добавить ученика",
  "trainer.session": "Сессия",
  "trainer.newSession": "Новая сессия",
  "trainer.cardEditor": "Редактор карточки",
  "trainer.draft": "Черновик",
  "trainer.approve": "Утвердить",
  "trainer.reject": "Отклонить",
  "trainer.finishReview": "Завершить разбор",
  "trainer.cards": "Карточки",
  "trainer.masterPlan": "Мастер-план",

  // Goals
  "goals.new": "Новая цель",
  "goals.searchProblems": "Найдите проблему…",
  "goals.customProblem": "Своя формулировка",
  "goals.howManySessions": "Сколько сессий планируете?",
  "goals.create": "Создать цель",
  "goals.problemsSelected": "проблем выбрано",

  // Sessions
  "sessions.title": "Сессия",
  "sessions.status.planned": "Запланирована",
  "sessions.status.completed": "Завершена",
  "sessions.notes": "Заметки",
  "sessions.exercises": "Упражнения",
  "sessions.insights": "Карточки",
  "sessions.markComplete": "Отметить как завершённую",

  // Master plan
  "masterPlan.title": "Мастер-план",
  "masterPlan.empty": "Тренер ещё не оформил мастер-план.",
  "masterPlan.addSection": "Добавить раздел",
  "masterPlan.addItem": "Добавить пункт",
  "masterPlan.sectionTitle": "Название раздела",
  "masterPlan.itemText": "Текст пункта",

  // Matches
  "matches.title": "Матчи",
  "matches.tabUpcoming": "Предстоящие",
  "matches.tabPast": "Прошедшие",
  "matches.refresh": "Обновить",
  "matches.addByUrl": "Добавить по ссылке",
  "matches.addByUrlPlaceholder": "https://app.playtomic.io/matches/…",
  "matches.addByUrlSubmit": "Добавить",
  "matches.addByUrlAdding": "Добавление…",
  "matches.emptyUpcoming": "Нет предстоящих матчей",
  "matches.emptyPast": "Нет прошедших матчей",
  "matches.noPlaytomic": "Подключи Playtomic, чтобы видеть матчи.",
  "matches.goToSettings": "Настройки профиля",
  "matches.goalsCount": "целей",
  "matches.setGoals": "Поставь цели",
  "matches.refreshing": "Обновление…",

  // Language switcher
  "lang.label": "Язык",
  "lang.ru": "Русский",
  "lang.en": "English",
} as const;

const en: Record<keyof typeof ru, string> = {
  "common.create": "Create",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.back": "Back",
  "common.next": "Next",
  "common.skip": "Skip",
  "common.take": "Take",
  "common.search": "Search",
  "common.loading": "Loading…",
  "common.more": "more",
  "common.new": "New",
  "common.done": "Done",
  "common.actionRequired": "Action required",
  "common.completed": "Completed",
  "common.upcoming": "Upcoming",
  "common.items": "items",

  "login.title": "Sign in to Nivel",
  "login.subtitle": "Padel platform for coaches and players",
  "login.viaGrechka": "Sign in with Гречка",
  "login.viaGoogle": "Sign in with Google",
  "login.error": "Could not sign in. Try again.",

  "nav.home": "Home",
  "nav.insights": "Insights",
  "nav.matches": "Matches",
  "nav.logout": "Sign out",

  "dashboard.welcome": "Welcome,",
  "dashboard.player": "Player",
  "dashboard.emptyHint":
    "Start by creating your first goal — pick the problems you want to work on.",
  "dashboard.createGoal": "Create goal",
  "dashboard.insightsToReview": "new insights to review",
  "dashboard.insightsToReview.one": "new insight to review",
  "dashboard.fromSession": "From session",
  "dashboard.andMore": "and",
  "dashboard.masterPlan": "Master Plan",
  "dashboard.moreSections": "more sections",
  "dashboard.currentPlan": "Current plan",
  "dashboard.activeGoals": "Active goals",
  "dashboard.sessions": "sessions",
  "dashboard.skillProgression": "Skill progression",
  "dashboard.sessionHistory": "Session history",
  "dashboard.session": "Session",
  "dashboard.nextSession": "Next session",
  "dashboard.exercises": "Exercises",

  "insights.title": "Insight vault",
  "insights.empty": "No insights yet. They appear after sessions with your coach.",
  "insights.filterAll": "All",
  "insights.take": "Take",
  "insights.skip": "Skip",
  "insights.skipped": "Skipped",
  "insights.allReviewed": "All insights reviewed 🎉",
  "insights.swipeHint": "Swipe left to skip, right to take",
  "insights.category": "Category",

  "trainer.students": "Students",
  "trainer.library": "Library",
  "trainer.addStudent": "Add student",
  "trainer.session": "Session",
  "trainer.newSession": "New session",
  "trainer.cardEditor": "Card editor",
  "trainer.draft": "Draft",
  "trainer.approve": "Approve",
  "trainer.reject": "Reject",
  "trainer.finishReview": "Finish review",
  "trainer.cards": "Cards",
  "trainer.masterPlan": "Master plan",

  "goals.new": "New goal",
  "goals.searchProblems": "Find a problem…",
  "goals.customProblem": "Custom problem",
  "goals.howManySessions": "How many sessions do you plan?",
  "goals.create": "Create goal",
  "goals.problemsSelected": "problems selected",

  "sessions.title": "Session",
  "sessions.status.planned": "Planned",
  "sessions.status.completed": "Completed",
  "sessions.notes": "Notes",
  "sessions.exercises": "Exercises",
  "sessions.insights": "Insights",
  "sessions.markComplete": "Mark complete",

  "masterPlan.title": "Master plan",
  "masterPlan.empty": "Coach hasn't built the master plan yet.",
  "masterPlan.addSection": "Add section",
  "masterPlan.addItem": "Add item",
  "masterPlan.sectionTitle": "Section title",
  "masterPlan.itemText": "Item text",

  "lang.label": "Language",
  "lang.ru": "Русский",
  "lang.en": "English",

  // Matches
  "matches.title": "Matches",
  "matches.tabUpcoming": "Upcoming",
  "matches.tabPast": "Past",
  "matches.refresh": "Refresh",
  "matches.addByUrl": "Add by link",
  "matches.addByUrlPlaceholder": "https://app.playtomic.io/matches/…",
  "matches.addByUrlSubmit": "Add",
  "matches.addByUrlAdding": "Adding…",
  "matches.emptyUpcoming": "No upcoming matches",
  "matches.emptyPast": "No past matches",
  "matches.noPlaytomic": "Connect Playtomic to see your matches.",
  "matches.goToSettings": "Profile settings",
  "matches.goalsCount": "goals",
  "matches.setGoals": "Set goals",
  "matches.refreshing": "Refreshing…",
};

export type DictKey = keyof typeof ru;
export const dict = { ru, en } as const;

export type Locale = "ru" | "en";
export const DEFAULT_LOCALE: Locale = "ru";

export function t(locale: Locale, key: DictKey): string {
  return dict[locale][key] ?? dict[DEFAULT_LOCALE][key] ?? key;
}
