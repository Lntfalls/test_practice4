'use strict';
const { createApp } = require('../../src/app');

let server;
let base;

beforeEach(async () => {
  server = createApp({ seed: [] });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/health отвечает HTTP 200', async () => {
  const response = await fetch(`${base}/api/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('POST /api/tickets создает корректную заявку', async () => {
  const response = await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Сбой принтера', description: 'Принтер в аудитории не отвечает',
      category: 'hardware', priority: 'medium'
    })
  });
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.ticket.id).toBe(1);
  expect(body.ticket.status).toBe('new');
});


//I-01: создание и последующее чтение
test('I-01: POST создаёт, GET возвращает ту же заявку', async () => {
  // Arrange
  const payload = {
    title: 'Сбой VPN',
    description: 'Не удается подключиться к учебной сети',
    category: 'network',
    priority: 'high'
  };

  // Act
  const create = await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const created = await create.json();
  const list = await fetch(`${base}/api/tickets`);
  const body = await list.json();

  // Assert
  expect(create.status).toBe(201);
  expect(created.ticket.title).toBe('Сбой VPN');
  expect(created.ticket.status).toBe('new');
  expect(body.total).toBe(1);
  expect(body.items[0].id).toBe(created.ticket.id);
});

// ==== I-02: ошибка валидации не меняет количество ====
test('I-02: невалидный POST -> 400, количество заявок не меняется', async () => {
  // Arrange
  const before = await (await fetch(`${base}/api/tickets`)).json();

  // Act
  const response = await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'x',
      description: 'x',
      category: 'network',
      priority: 'low'
    })
  });
  const after = await (await fetch(`${base}/api/tickets`)).json();

  // Assert
  expect(response.status).toBe(400);
  expect(after.total).toBe(before.total);
});

// ==== I-03: поиск без учёта регистра ====
test('I-03: GET ?search=vpn находит VPN без учёта регистра', async () => {
  await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'VPN недоступен',
      description: 'Не удается подключиться к учебной сети',
      category: 'network',
      priority: 'high'
    })
  });

  const response = await fetch(`${base}/api/tickets?search=vpn`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.total).toBe(1);
  expect(body.items[0].title).toBe('VPN недоступен');
});

// ==== I-04: комбинированные фильтры ====
test('I-04: search + status + category работают совместно (AND)', async () => {
  const seed = [
    { title: 'VPN сеть упала', description: 'Не работает удаленный доступ', category: 'network', priority: 'high' },
    { title: 'VPN сеть упала 2', description: 'Второй инцидент по сети', category: 'network', priority: 'medium' },
    { title: 'ПО не запускается', description: 'Ошибка при старте приложения', category: 'software', priority: 'high' }
  ];
  for (const t of seed) {
    await fetch(`${base}/api/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(t)
    });
  }

  const response = await fetch(
      `${base}/api/tickets?search=VPN&status=new&category=network`
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.total).toBe(2);
  expect(body.items.every((t) => t.category === 'network' && t.status === 'new')).toBe(true);
});

// ==== I-05: запрещённый переход статуса ====
test('I-05: PATCH new -> resolved возвращает 409', async () => {
  const created = await (await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Тестовая заявка',
      description: 'Описание для тестовой заявки',
      category: 'software',
      priority: 'medium'
    })
  })).json();

  const response = await fetch(
      `${base}/api/tickets/${created.ticket.id}/status`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      }
  );

  expect(response.status).toBe(409);
  // Проверяем, что статус не изменился
  const list = await (await fetch(`${base}/api/tickets`)).json();
  const current = list.items.find((t) => t.id === created.ticket.id);
  expect(current.status).toBe('new');
});

// ==== I-06: PATCH: 400 для неизвестного статуса, 404 для несуществующего id ====
test('I-06a: PATCH с неизвестным статусом -> 400', async () => {
  const created = await (await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Валидная тема',
      description: 'Описание достаточной длины',
      category: 'hardware',
      priority: 'low'
    })
  })).json();

  const response = await fetch(
      `${base}/api/tickets/${created.ticket.id}/status`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'done' })
      }
  );
  expect(response.status).toBe(400);
});

test('I-06b: PATCH для несуществующего id -> 404', async () => {
  const response = await fetch(`${base}/api/tickets/9999/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' })
  });
  expect(response.status).toBe(404);
});

// ==== I-07: порядок в ответе API ====
test('I-07: GET /api/tickets сортирует high -> medium -> low', async () => {
  const seed = [
    { title: 'Низкий приоритет', description: 'Описание low заявки', category: 'software', priority: 'low' },
    { title: 'Высокий приоритет', description: 'Описание high заявки', category: 'network', priority: 'high' },
    { title: 'Средний приоритет', description: 'Описание medium заявки', category: 'hardware', priority: 'medium' }
  ];
  for (const t of seed) {
    await fetch(`${base}/api/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(t)
    });
  }

  const body = await (await fetch(`${base}/api/tickets`)).json();
  expect(body.items.map((t) => t.priority)).toEqual(['high', 'medium', 'low']);
});

test('GET /api/tickets?priority=high возвращает только high', async () => {
  // Создаём две заявки с разным приоритетом
  await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'High заявка', description: 'Описание high заявки',
      category: 'network', priority: 'high'
    })
  });
  await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Low заявка', description: 'Описание low заявки',
      category: 'network', priority: 'low'
    })
  });

  const response = await fetch(`${base}/api/tickets?priority=high`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.items.every(t => t.priority === 'high')).toBe(true);
});
// Добавьте проверки GET с фильтрами, некорректных запросов,
// запретных переходов статуса и последовательных запросов к API.
