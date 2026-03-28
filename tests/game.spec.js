const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE = `file://${path.resolve(__dirname, '..', 'index.html')}`;

test.beforeEach(async ({ page }) => {
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ─── Layout ────────────────────────────────────────────────────────
test('page has correct title', async ({ page }) => {
  await expect(page).toHaveTitle('Tic-Tac-Toe');
});

test('board renders 9 cells', async ({ page }) => {
  await expect(page.locator('.cell')).toHaveCount(9);
});

test('scores start at zero', async ({ page }) => {
  await expect(page.locator('#score-x')).toHaveText('0');
  await expect(page.locator('#score-o')).toHaveText('0');
  await expect(page.locator('#score-draw')).toHaveText('0');
});

test('status starts as X\'S TURN', async ({ page }) => {
  await expect(page.locator('#status')).toHaveText("X'S TURN");
});

// ─── Gameplay ──────────────────────────────────────────────────────
test('clicking a cell places X first', async ({ page }) => {
  await page.locator('.cell').first().click();
  await expect(page.locator('.cell').first()).toHaveText('X');
  await expect(page.locator('#status')).toHaveText("O'S TURN");
});

test('turns alternate X then O', async ({ page }) => {
  const cells = page.locator('.cell');
  await cells.nth(0).click();
  await cells.nth(1).click();
  await expect(cells.nth(0)).toHaveText('X');
  await expect(cells.nth(1)).toHaveText('O');
  await expect(page.locator('#status')).toHaveText("X'S TURN");
});

test('cannot overwrite an occupied cell', async ({ page }) => {
  const cell = page.locator('.cell').first();
  await cell.click(); // X
  await cell.click(); // should be ignored
  await expect(page.locator('#status')).toHaveText("O'S TURN");
  await expect(cell).toHaveText('X');
});

// ─── Win detection ─────────────────────────────────────────────────
test('X wins on top row', async ({ page }) => {
  const cells = page.locator('.cell');
  await cells.nth(0).click(); // X
  await cells.nth(3).click(); // O
  await cells.nth(1).click(); // X
  await cells.nth(4).click(); // O
  await cells.nth(2).click(); // X wins [0,1,2]
  await expect(page.locator('#win-overlay')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('#win-player')).toHaveText('X');
  await expect(page.locator('#win-label')).toHaveText('WINS!');
});

test('O wins on left column', async ({ page }) => {
  const cells = page.locator('.cell');
  await cells.nth(1).click(); // X
  await cells.nth(0).click(); // O
  await cells.nth(2).click(); // X
  await cells.nth(3).click(); // O
  await cells.nth(4).click(); // X
  await cells.nth(6).click(); // O wins [0,3,6]
  await expect(page.locator('#win-overlay')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('#win-player')).toHaveText('O');
});

test('X wins on diagonal', async ({ page }) => {
  const cells = page.locator('.cell');
  await cells.nth(0).click(); // X
  await cells.nth(1).click(); // O
  await cells.nth(4).click(); // X
  await cells.nth(2).click(); // O
  await cells.nth(8).click(); // X wins [0,4,8]
  await expect(page.locator('#win-overlay')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('#win-player')).toHaveText('X');
});

// ─── Draw detection ────────────────────────────────────────────────
test('detects a draw', async ({ page }) => {
  // Board result: X O X / O O X / X X O  — no winner
  const cells = page.locator('.cell');
  const moves = [0, 1, 2, 3, 5, 4, 6, 8, 7];
  for (const i of moves) await cells.nth(i).click();
  await expect(page.locator('#win-overlay')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('#win-label')).toHaveText('GOOD GAME!');
});

// ─── Scores ────────────────────────────────────────────────────────
test('X score increments after win', async ({ page }) => {
  const cells = page.locator('.cell');
  await cells.nth(0).click(); // X
  await cells.nth(3).click(); // O
  await cells.nth(1).click(); // X
  await cells.nth(4).click(); // O
  await cells.nth(2).click(); // X wins
  await page.waitForTimeout(900);
  await expect(page.locator('#score-x')).toHaveText('1');
});

test('reset scores sets all to zero', async ({ page }) => {
  const cells = page.locator('.cell');
  await cells.nth(0).click(); // X
  await cells.nth(3).click(); // O
  await cells.nth(1).click(); // X
  await cells.nth(4).click(); // O
  await cells.nth(2).click(); // X wins
  await expect(page.locator('#win-overlay')).toBeVisible({ timeout: 2000 });
  // Dismiss overlay before interacting with buttons beneath it
  await page.locator('#play-again').click({ force: true });
  await expect(page.locator('#win-overlay')).toBeHidden();
  await page.locator('#reset-scores').click();
  await expect(page.locator('#score-x')).toHaveText('0');
});

// ─── New Game ──────────────────────────────────────────────────────
test('new game clears the board', async ({ page }) => {
  const cells = page.locator('.cell');
  await cells.nth(0).click();
  await cells.nth(1).click();
  await page.locator('#restart').click();
  for (let i = 0; i < 9; i++) await expect(cells.nth(i)).toHaveText('');
  await expect(page.locator('#status')).toHaveText("X'S TURN");
});

test('play again from overlay resets board', async ({ page }) => {
  const cells = page.locator('.cell');
  await cells.nth(0).click(); // X
  await cells.nth(3).click(); // O
  await cells.nth(1).click(); // X
  await cells.nth(4).click(); // O
  await cells.nth(2).click(); // X wins
  await expect(page.locator('#win-overlay')).toBeVisible({ timeout: 2000 });
  // force:true bypasses stability check — button intentionally animates (pulse/shimmer)
  await page.locator('#play-again').click({ force: true });
  await expect(page.locator('#win-overlay')).toBeHidden();
  for (let i = 0; i < 9; i++) await expect(cells.nth(i)).toHaveText('');
});
