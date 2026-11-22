export class TicketsPage {
  open() { cy.visit('/'); }
  items() { return cy.get('[data-testid="ticket-item"]'); }
  count() { return cy.get('[data-testid="ticket-count"]'); }
  searchFor(text) {
    cy.get('[data-testid="search"]').clear().type(text);
  }
  setStatus(status) {
    cy.get('[data-testid="status-filter"]').select(status);
  }
  setCategory(category) {
    cy.get('[data-testid="category-filter"]').select(category);
  }
  itemByTitle(title) {
    return cy.get('[data-testid="ticket-item"]')
        .contains('[data-testid="ticket-item"]', title)
        .closest('[data-testid="ticket-item"]');
  }
}