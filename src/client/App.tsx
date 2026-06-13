import { useState } from 'react';
import { LessonSelect } from './ui/index.js';
import { LessonRunner } from './lesson/index.js';
import { getCurriculum } from '../session/index.js';

export default function App() {
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  if (activeLessonId !== null) {
    const lesson = getCurriculum().find(l => l.id === activeLessonId);
    if (lesson) {
      return (
        <LessonRunner
          lesson={lesson}
          onComplete={() => { setActiveLessonId(null); }}
        />
      );
    }
  }

  return <LessonSelect onStart={setActiveLessonId} />;
}
