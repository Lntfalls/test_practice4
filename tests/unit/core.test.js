'use strict';
const {
  normalizeTitle,
  validateTicketInput,
  canChangeStatus,
  filterAndSort
} = require('../../src/core');

describe('Базовые unit-тесты', () => {
  test('удаляет пробелы в начале и конце темы', () => {
    expect(normalizeTitle('  Ошибка принтера  ')).toBe('Ошибка принтера');
  });

  test('отклоняет неизвестную категорию', () => {
    const errors = validateTicketInput({
      title: 'Ошибка печати',
      description: 'Принтер не печатает документ',
      category: 'unknown',
      priority: 'low'
    });
    expect(errors).toHaveProperty('category');
  });

  test('запрещает возвращение из закрытого статуса', () => {
    expect(canChangeStatus('resolved', 'new')).toBe(false);
  });
});

// ==== U-01, U-02: нормализация темы ====
describe('normalizeTitle: схлопывание пробелов (U-01, U-02)', () => {
  test.each([
    ['  Сбой   VPN  ', 'Сбой VPN'],
    ['\tОшибка\n сети ', 'Ошибка сети'],
    ['Нет   доступа', 'Нет доступа'],
    ['Один', 'Один']
  ])('normalizeTitle(%p) => %p', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });
});

// ==== U-02: длина темы проверяется после нормализации ====
describe('validateTicketInput: граница длины темы после нормализации', () => {
  test('тема из 4 видимых символов с пробелами отклоняется', () => {
    const errors = validateTicketInput({
      title: '     abcd     ', // после trim -> "abcd" = 4 символа
      description: '1234567890',
      category: 'network',
      priority: 'low'
    });
    expect(errors).toHaveProperty('title');
  });

  test('тема из 5 видимых символов принимается', () => {
    const errors = validateTicketInput({
      title: '     abcde     ',
      description: '1234567890',
      category: 'network',
      priority: 'low'
    });
    expect(errors).not.toHaveProperty('title');
  });
});

// ==== U-03: границы 5 / 80 ====
describe('validateTicketInput: границы темы 5 и 80', () => {
  test.each([
    ['a'.repeat(4), false],
    ['a'.repeat(5), true],
    ['a'.repeat(80), true],
    ['a'.repeat(81), false]
  ])('тема длиной %p валидна=%p', (title, valid) => {
    const errors = validateTicketInput({
      title,
      description: '1234567890',
      category: 'network',
      priority: 'low'
    });
    expect(Boolean(errors.title)).toBe(!valid);
  });
});

// ==== U-04: границы описания 10 / 500 ====
describe('validateTicketInput: границы описания 10 и 500', () => {
  test.each([
    ['a'.repeat(9), false],
    ['a'.repeat(10), true],
    ['a'.repeat(500), true],
    ['a'.repeat(501), false]
  ])('описание длиной %p валидно=%p', (description, valid) => {
    const errors = validateTicketInput({
      title: 'Нормальная тема',
      description,
      category: 'network',
      priority: 'low'
    });
    expect(Boolean(errors.description)).toBe(!valid);
  });
});

// ==== U-05, U-06: переходы статусов ====
describe('canChangeStatus: правила переходов (U-05, U-06)', () => {
  test.each([
    ['new', 'in_progress', true],
    ['new', 'resolved', false],       // запрещённый пропуск этапа
    ['in_progress', 'resolved', true],
    ['resolved', 'in_progress', false],
    ['resolved', 'new', false],
    ['new', 'new', false],
    ['unknown', 'resolved', false]
  ])('%s -> %s = %p', (from, to, expected) => {
    expect(canChangeStatus(from, to)).toBe(expected);
  });
});

// ==== U-07: порядок по приоритету ====
describe('filterAndSort: порядок high -> medium -> low (U-07)', () => {
  test('high выше medium, medium выше low', () => {
    const tickets = [
      { id: 1, priority: 'low',    createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 2, priority: 'high',   createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 3, priority: 'medium', createdAt: '2026-10-01T00:00:00.000Z' }
    ];
    expect(filterAndSort(tickets).map((t) => t.id)).toEqual([2, 3, 1]);
  });
});

// ==== U-08: при равном приоритете — новые выше ====
describe('filterAndSort: при равном приоритете новые выше (U-08)', () => {
  test('более новый createdAt идёт первым', () => {
    const tickets = [
      { id: 1, priority: 'high', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 2, priority: 'high', createdAt: '2026-10-02T00:00:00.000Z' },
      { id: 3, priority: 'high', createdAt: '2026-10-03T00:00:00.000Z' }
    ];
    expect(filterAndSort(tickets).map((t) => t.id)).toEqual([3, 2, 1]);
  });
});