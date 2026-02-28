import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import cyberSecurityQuestions from './cyberSecurity.json';
import androidQuestions from './android.json';
import inclusionQuestions from './inclusion.json';
import componentProgrammingQuestions from './componentProgramming.json';

const STORAGE_KEY = 'quiz-progress-v1';
const QUESTIONS_PER_TEST = 30;
const MAIN_TESTS_COUNT = 10;
const RANDOM_TEST_ID = 11;

const SUBJECTS = [
  { id: 'cyberSecurity', title: 'КиберБезопасность', questions: cyberSecurityQuestions },
  { id: 'android', title: 'Андроид', questions: androidQuestions },
  { id: 'inclusion', title: 'Обучение через инклюзию', questions: inclusionQuestions },
  {
    id: 'componentProgramming',
    title: 'Компонентное программирование',
    questions: componentProgrammingQuestions,
  },
];

const buildSequentialTests = (questionsLength) => {
  const tests = [];

  for (let i = 0; i < MAIN_TESTS_COUNT; i += 1) {
    const start = i === MAIN_TESTS_COUNT - 1 ? QUESTIONS_PER_TEST * (MAIN_TESTS_COUNT - 1) : i * QUESTIONS_PER_TEST;
    const end = i === MAIN_TESTS_COUNT - 1 ? questionsLength : Math.min((i + 1) * QUESTIONS_PER_TEST, questionsLength);

    if (start >= questionsLength || end <= start) {
      continue;
    }

    const questionIndexes = Array.from({ length: end - start }, (_, idx) => start + idx);
    tests.push({
      id: i + 1,
      title: `Тест ${i + 1}`,
      type: 'main',
      questionIndexes,
    });
  }

  const randomPoolLimit = Math.min(300, questionsLength);
  if (randomPoolLimit > 0) {
    tests.push({
      id: RANDOM_TEST_ID,
      title: 'Тест 11 — Рандомный',
      type: 'random',
      questionIndexes: Array.from({ length: randomPoolLimit }, (_, idx) => idx),
    });
  }

  return tests;
};

const shuffle = (items) => {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
};

const MainScreen = ({ onSelectSubject }) => (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="dark-content" />
    <View style={styles.container}>
      <Text style={styles.title}>Выберите предмет</Text>
      <View style={styles.buttonGroup}>
        {SUBJECTS.map((subject) => (
          <Pressable key={subject.id} style={styles.subjectButton} onPress={() => onSelectSubject(subject.id)}>
            <Text style={styles.subjectButtonText}>{subject.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  </SafeAreaView>
);

const SubjectTestsScreen = ({ subject, progressByTest, onBack, onStartTest }) => {
  const tests = useMemo(() => buildSequentialTests(subject.questions.length), [subject.questions.length]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </Pressable>
        <Text style={styles.title}>{subject.title}</Text>
        <Text style={styles.subtitle}>Всего вопросов: {subject.questions.length}</Text>

        <FlatList
          data={tests}
          keyExtractor={(item) => `${item.id}`}
          contentContainerStyle={styles.testList}
          renderItem={({ item }) => {
            const progress = progressByTest[item.id] || { bestScore: 0, total: item.type === 'random' ? 30 : item.questionIndexes.length, passed: false };
            return (
              <Pressable style={styles.testCard} onPress={() => onStartTest(item)}>
                <View>
                  <Text style={styles.testTitle}>{item.title}</Text>
                  <Text style={styles.testMeta}>
                    Вопросов: {item.type === 'random' ? Math.min(QUESTIONS_PER_TEST, item.questionIndexes.length) : item.questionIndexes.length}
                  </Text>
                  <Text style={styles.testMeta}>
                    Лучший результат: {progress.bestScore}/{progress.total}
                  </Text>
                </View>
                <Text style={styles.statusIcon}>{progress.passed ? '✔' : '○'}</Text>
              </Pressable>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const prepareQuestionsForAttempt = (subjectQuestions, test) => {
  let indexes = test.questionIndexes;

  if (test.type === 'random') {
    indexes = shuffle(test.questionIndexes).slice(0, Math.min(QUESTIONS_PER_TEST, test.questionIndexes.length));
  }

  const ordered = indexes.map((questionIndex) => {
    const source = subjectQuestions[questionIndex];
    return {
      originalIndex: questionIndex,
      question: source.question,
      correctAnswer: source.correctAnswer,
      options: shuffle(source.options),
    };
  });

  return shuffle(ordered);
};

const QuizScreen = ({
  subject,
  test,
  questions,
  attemptType,
  currentIndex,
  selectedOption,
  feedback,
  onSelectOption,
  onNext,
  onExit,
}) => {
  const currentQuestion = questions[currentIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.quizHeader}>
          <Pressable onPress={onExit} style={styles.backButton}>
            <Text style={styles.backButtonText}>← К тестам</Text>
          </Pressable>
          <Text style={styles.subtitle}>{subject.title}</Text>
          <Text style={styles.title}>{test.title}</Text>
          <Text style={styles.subtitle}>
            {attemptType === 'mistakes' ? 'Работа над ошибками' : 'Основной проход'} • Вопрос {currentIndex + 1}/{questions.length}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.quizBody}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          {currentQuestion.options.map((option) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = currentQuestion.correctAnswer === option;
            const shouldReveal = feedback !== null;

            let optionStyle = styles.optionButton;
            if (isSelected) {
              optionStyle = [styles.optionButton, styles.optionButtonSelected];
            }
            if (shouldReveal && isCorrectOption) {
              optionStyle = [styles.optionButton, styles.optionButtonCorrect];
            }
            if (shouldReveal && isSelected && !isCorrectOption) {
              optionStyle = [styles.optionButton, styles.optionButtonWrong];
            }

            return (
              <Pressable
                key={option}
                style={optionStyle}
                disabled={feedback !== null}
                onPress={() => onSelectOption(option)}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.feedbackArea}>
          {feedback !== null && (
            <>
              <Text style={feedback.isCorrect ? styles.correctText : styles.wrongText}>
                {feedback.isCorrect ? '✅ Правильно' : '❌ Неправильно'}
              </Text>
              <Text style={styles.correctAnswerText}>Правильный ответ: {currentQuestion.correctAnswer}</Text>
            </>
          )}

          <Pressable
            style={styles.primaryButton}
            onPress={onNext}
            disabled={selectedOption === null && feedback === null}
          >
            <Text style={styles.primaryButtonText}>
              {feedback === null ? 'Ответить' : currentIndex === questions.length - 1 ? 'Завершить' : 'Следующий вопрос'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const ResultScreen = ({ state, onBackToTests, onStartMistakes, onFinish }) => {
  const {
    subject,
    test,
    mainCorrect,
    total,
    mistakes,
    finalCorrect,
    randomReview,
  } = state;

  const isRandom = test.type === 'random';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.subtitle}>{subject.title}</Text>
        <Text style={styles.title}>{test.title}</Text>

        <Text style={styles.resultScore}>Результат: {finalCorrect}/{total}</Text>
        {finalCorrect === total && <Text style={styles.correctText}>✔ Пройден</Text>}

        {!isRandom && mistakes.length > 0 && finalCorrect < total && (
          <>
            <Text style={styles.subtitle}>Ошибок в основном проходе: {mistakes.length}</Text>
            <Pressable style={styles.primaryButton} onPress={onStartMistakes}>
              <Text style={styles.primaryButtonText}>Работа над ошибками</Text>
            </Pressable>
          </>
        )}

        {!isRandom && mistakes.length > 0 && finalCorrect >= total && (
          <Text style={styles.subtitle}>После работы над ошибками результат обновлен.</Text>
        )}

        {isRandom && (
          <View style={styles.randomReviewContainer}>
            <Text style={styles.subtitle}>Разбор ответов:</Text>
            <FlatList
              data={randomReview}
              keyExtractor={(item, idx) => `${item.originalIndex}-${idx}`}
              renderItem={({ item, index }) => (
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewQuestion}>{index + 1}. {item.question}</Text>
                  <Text style={item.isCorrect ? styles.correctText : styles.wrongText}>
                    {item.isCorrect ? '✅ Верно' : '❌ Неверно'}
                  </Text>
                  {!item.isCorrect && (
                    <Text style={styles.correctAnswerText}>Правильный: {item.correctAnswer}</Text>
                  )}
                </View>
              )}
              style={styles.reviewList}
            />
          </View>
        )}

        <Pressable style={styles.primaryButton} onPress={onFinish}>
          <Text style={styles.primaryButtonText}>К списку тестов</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBackToTests}>
          <Text style={styles.secondaryButtonText}>На главный экран</Text>
        </Pressable>
        {!isRandom && mistakes.length === 0 && mainCorrect < total && (
          <Text style={styles.subtitle}>Работа над ошибками не требуется.</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  const [screen, setScreen] = useState('main');
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [attemptType, setAttemptType] = useState('main');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [mainMistakes, setMainMistakes] = useState([]);
  const [mainCorrect, setMainCorrect] = useState(0);
  const [mistakeCorrect, setMistakeCorrect] = useState(0);
  const [randomReview, setRandomReview] = useState([]);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setProgress(JSON.parse(raw));
        }
      } catch (error) {
        console.warn('Failed to load progress', error);
      }
    };

    loadProgress();
  }, []);

  const selectedSubject = SUBJECTS.find((subject) => subject.id === selectedSubjectId) || null;

  const persistProgress = async (nextProgress) => {
    setProgress(nextProgress);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextProgress));
    } catch (error) {
      console.warn('Failed to save progress', error);
    }
  };

  const startMainAttempt = (subject, test) => {
    const prepared = prepareQuestionsForAttempt(subject.questions, test);
    setQuestions(prepared);
    setSelectedTest(test);
    setAttemptType('main');
    setCurrentIndex(0);
    setSelectedOption(null);
    setFeedback(null);
    setMainMistakes([]);
    setMainCorrect(0);
    setMistakeCorrect(0);
    setRandomReview([]);
    setScreen('quiz');
  };

  const handleAnswerAction = () => {
    const currentQuestion = questions[currentIndex];

    if (!feedback) {
      const isCorrect = selectedOption === currentQuestion.correctAnswer;
      setFeedback({ isCorrect });

      if (attemptType === 'main') {
        if (isCorrect) {
          setMainCorrect((prev) => prev + 1);
        } else if (selectedTest.type !== 'random') {
          setMainMistakes((prev) => [...prev, currentQuestion]);
        }

        if (selectedTest.type === 'random') {
          setRandomReview((prev) => [
            ...prev,
            {
              ...currentQuestion,
              isCorrect,
              selectedOption,
            },
          ]);
        }
      }

      if (attemptType === 'mistakes' && isCorrect) {
        setMistakeCorrect((prev) => prev + 1);
      }

      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setFeedback(null);
      return;
    }

    const total = selectedTest.type === 'random' ? Math.min(QUESTIONS_PER_TEST, selectedTest.questionIndexes.length) : selectedTest.questionIndexes.length;

    if (attemptType === 'main') {
      setScreen('result');
      return;
    }

    const finalCorrect = mainCorrect + mistakeCorrect;
    const nextProgress = {
      ...progress,
      [selectedSubject.id]: {
        ...(progress[selectedSubject.id] || {}),
        [selectedTest.id]: {
          bestScore: Math.max(
            progress[selectedSubject.id]?.[selectedTest.id]?.bestScore || 0,
            finalCorrect,
          ),
          total,
          passed: finalCorrect === total,
        },
      },
    };
    persistProgress(nextProgress);
    setScreen('result');
  };

  const startMistakesAttempt = () => {
    const retryQuestions = shuffle(mainMistakes).map((question) => ({
      ...question,
      options: shuffle(question.options),
    }));

    setQuestions(retryQuestions);
    setAttemptType('mistakes');
    setCurrentIndex(0);
    setSelectedOption(null);
    setFeedback(null);
    setScreen('quiz');
  };

  const finishMainAttempt = async () => {
    const total = selectedTest.type === 'random' ? Math.min(QUESTIONS_PER_TEST, selectedTest.questionIndexes.length) : selectedTest.questionIndexes.length;
    const finalCorrect = selectedTest.type === 'random' ? mainCorrect : mainCorrect + mistakeCorrect;

    const nextProgress = {
      ...progress,
      [selectedSubject.id]: {
        ...(progress[selectedSubject.id] || {}),
        [selectedTest.id]: {
          bestScore: Math.max(
            progress[selectedSubject.id]?.[selectedTest.id]?.bestScore || 0,
            finalCorrect,
          ),
          total,
          passed: finalCorrect === total,
        },
      },
    };

    await persistProgress(nextProgress);
    setScreen('tests');
  };

  const getResultState = () => {
    const total = selectedTest.type === 'random' ? Math.min(QUESTIONS_PER_TEST, selectedTest.questionIndexes.length) : selectedTest.questionIndexes.length;
    const finalCorrect = selectedTest.type === 'random' ? mainCorrect : mainCorrect + mistakeCorrect;

    return {
      subject: selectedSubject,
      test: selectedTest,
      total,
      mainCorrect,
      mistakes: mainMistakes,
      finalCorrect,
      randomReview,
    };
  };

  if (screen === 'main') {
    return (
      <MainScreen
        onSelectSubject={(subjectId) => {
          setSelectedSubjectId(subjectId);
          setScreen('tests');
        }}
      />
    );
  }

  if (screen === 'tests' && selectedSubject) {
    return (
      <SubjectTestsScreen
        subject={selectedSubject}
        progressByTest={progress[selectedSubject.id] || {}}
        onBack={() => setScreen('main')}
        onStartTest={(test) => startMainAttempt(selectedSubject, test)}
      />
    );
  }

  if (screen === 'quiz' && selectedSubject && selectedTest && questions.length > 0) {
    return (
      <QuizScreen
        subject={selectedSubject}
        test={selectedTest}
        questions={questions}
        attemptType={attemptType}
        currentIndex={currentIndex}
        selectedOption={selectedOption}
        feedback={feedback}
        onSelectOption={setSelectedOption}
        onNext={handleAnswerAction}
        onExit={() => setScreen('tests')}
      />
    );
  }

  if (screen === 'result' && selectedSubject && selectedTest) {
    return (
      <ResultScreen
        state={getResultState()}
        onBackToTests={() => {
          setSelectedSubjectId(null);
          setSelectedTest(null);
          setScreen('main');
        }}
        onStartMistakes={startMistakesAttempt}
        onFinish={finishMainAttempt}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
  },
  buttonGroup: {
    marginTop: 12,
    gap: 12,
  },
  subjectButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  subjectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backButtonText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '600',
  },
  testList: {
    paddingBottom: 16,
    gap: 10,
  },
  testCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  testMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusIcon: {
    fontSize: 24,
    color: '#16a34a',
    fontWeight: '700',
  },
  quizHeader: {
    marginBottom: 8,
  },
  quizBody: {
    gap: 10,
    paddingBottom: 24,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  optionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
  },
  optionButtonSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  optionButtonCorrect: {
    borderColor: '#16a34a',
    backgroundColor: '#dcfce7',
  },
  optionButtonWrong: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  optionText: {
    fontSize: 15,
    color: '#111827',
  },
  feedbackArea: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    gap: 8,
  },
  correctText: {
    color: '#16a34a',
    fontWeight: '700',
  },
  wrongText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  correctAnswerText: {
    color: '#374151',
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  resultScore: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  randomReviewContainer: {
    flex: 1,
    marginTop: 12,
    width: '100%',
  },
  reviewList: {
    marginTop: 8,
  },
  reviewItem: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    marginBottom: 8,
  },
  reviewQuestion: {
    color: '#111827',
    marginBottom: 4,
  },
});
