import { create } from 'zustand';
import { type SessionRecord } from './schema.js';
import { loadSession, saveSession, emptySession } from './db.js';

interface SessionStore {
  record: SessionRecord;

  loadFromDB: () => Promise<void>;
  completeLesson: (lessonId: string, score: number) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  record: emptySession(),

  loadFromDB: async () => {
    const record = await loadSession();
    set({ record: record ?? emptySession() });
  },

  completeLesson: async (lessonId: string, score: number) => {
    const { record } = get();
    const now = Date.now();
    const existing = record.lessons.find((l) => l.lessonId === lessonId);
    let updatedLessons;
    if (existing != null) {
      updatedLessons = record.lessons.map((l) =>
        l.lessonId === lessonId
          ? {
              ...l,
              completedAt: now,
              bestScore: Math.max(l.bestScore, score),
            }
          : l,
      );
    } else {
      updatedLessons = [
        ...record.lessons,
        { lessonId, completedAt: now, bestScore: score },
      ];
    }
    const updated: SessionRecord = {
      ...record,
      lastOpenedAt: now,
      lessons: updatedLessons,
    };
    set({ record: updated });
    await saveSession(updated);
  },

}));
