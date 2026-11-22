import { TicketsPage } from '../pages/TicketsPage';
import { TicketForm } from '../pages/TicketForm';

const page = new TicketsPage();
const form = new TicketForm();

describe('HelpDesk — E2E-проверки', () => {
  beforeEach(() => {
    // Сброс работает только при npm run start:test.
    cy.request('POST', '/api/__reset');
  });

  it('показывает исходные 4 заявки', () => {
    page.open();
    cy.get('[data-testid="page-title"]').should('contain', 'HelpDesk');
    page.items().should('have.length', 4);
    page.count().should('have.text', '4');
  });

  it('E-01: создаёт заявку через форму', () => {
    page.open();
    form.fill({
      title: 'Сбой VPN в корпусе',
      description: 'Не удается подключиться к учебной сети',
      category: 'network',
      priority: 'high'
    });

    cy.intercept('POST', '/api/tickets').as('createTicket');
    form.submit();
    cy.wait('@createTicket').its('response.statusCode').should('eq', 201);

    form.message().should('contain', 'создана');
    page.items().should('have.length', 5);
    page.itemByTitle('Сбой VPN в корпусе').should('exist');
  });

  it('E-02: поиск + фильтр по категории и статусу', () => {
    page.open();
    page.searchFor('vpn');
    page.setCategory('network');
    page.setStatus('new');

    page.items().should('have.length', 1);
    page.itemByTitle('VPN недоступен').should('exist');
    page.count().should('have.text', '1');
  });

  it('E-03: переводит заявку в работу и завершает через интерфейс', () => {
    page.open();
    const ticket = page.itemByTitle('VPN недоступен');

    ticket.within(() => {
      cy.contains('button', 'В работу').click();
    });

    page.itemByTitle('VPN недоступен').within(() => {
      cy.contains('В работе').should('exist');
      cy.contains('button', 'Завершить').click();
    });

    page.itemByTitle('VPN недоступен').within(() => {
      cy.contains('Завершена').should('exist');
    });
  });

  it('E-04: HTML из темы отображается как текст, не как разметка', () => {
    page.open();
    form.fill({
      title: '<b>Тема</b> с разметкой',
      description: '<img src=x onerror=alert(1)> описание события',
      category: 'software',
      priority: 'low'
    });

    cy.intercept('POST', '/api/tickets').as('createTicket');
    form.submit();
    cy.wait('@createTicket');

    // Никаких настоящих <b> и <img> внутри списка быть не должно.
    page.items().find('b').should('not.exist');
    page.items().find('img').should('not.exist');
    // А текстовая строка видна:
    page.itemByTitle('<b>Тема</b> с разметкой').should('exist');
  });
});
