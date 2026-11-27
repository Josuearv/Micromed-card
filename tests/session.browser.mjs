import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '../node_modules/.qa/node_modules/playwright-core';
import { buildEndTurnSteps, resolvePlayCard } from '../src/engine/combatEngine';
import { advanceToNextGuard, startNewRun, transitionRunOnVictory } from '../src/engine/runEngine';

const origin = process.env.QA_ORIGIN ?? 'http://127.0.0.1:4171';
const evidenceDir = process.env.QA_EVIDENCE;
if (evidenceDir) await mkdir(evidenceDir, { recursive: true });
const main = 'codigo_vital_save_v3';
const backup = 'codigo_vital_backup_v3';
const classic = startNewRun('classic', 12345);
const save = (run = classic) => ({
  schemaVersion: 3, savedAt: 1700000000000, inRoundSummary: false, recoveredLp: 0, run,
});
const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' });
const click = (page, name) => button(page, name).click();
const resume = (page) => click(page, /^Continuar \(/);
const get = (page, key = main) => page.evaluate((key) => localStorage.getItem(key), key);
const current = async (page) => JSON.parse(await get(page));
const capture = (page, label) => evidenceDir && page.screenshot({ path: evidenceDir + '/' + label + '.png' });
const settle = (page) => page.waitForFunction(() => !Array.from(document.querySelectorAll('button'))
  .some((button) => /Respuesta Brote/.test(button.textContent)));
const expectedTurn = (run) => {
  let duelState = run.duelState;
  for (const step of buildEndTurnSteps(run.rival)) {
    duelState = step.execute(duelState).nextState;
    if (duelState.playerLp <= 0 || duelState.rivalLp <= 0) break;
  }
  return JSON.parse(JSON.stringify({
    ...run, duelState, turnsElapsed: run.turnsElapsed + 1,
    playerLp: duelState.playerLp, rngState: duelState.rngState, idSequence: duelState.idSequence,
  }));
};
let failures = 0;
async function scenario(name, body, options = {}) {
  if (process.env.QA_CASE && !name.includes(process.env.QA_CASE)) return;
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  context.setDefaultTimeout(5000);
  const errors = [];
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  await context.addInitScript(({ fixture, backupFixture, deny, three, main, backup, appOrigin }) => {
    if (location.origin !== appOrigin) return;
    if (!localStorage.getItem('qa-initialized')) {
      if (fixture) localStorage.setItem(main, typeof fixture === 'string' ? fixture : JSON.stringify(fixture));
      if (backupFixture) localStorage.setItem(backup, JSON.stringify(backupFixture));
      localStorage.setItem('codigo_vital_prefs_v3', JSON.stringify({ tactical2D: !three, muted: true, speedMode: 'normal' }));
      localStorage.setItem('qa-initialized', '1');
    }
    window.qaDenied = deny;
    window.qaWrites = [];
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === main || key === backup) {
        if (window.qaDenied === true || window.qaDenied === key) throw new DOMException('QA denied', 'QuotaExceededError');
        window.qaWrites.push([key, value]);
      }
      return write.call(this, key, value);
    };
    Date.now = () => 12345;
    Math.random = () => 0;
  }, { main, backup, appOrigin: new URL(origin).origin, ...options });
  const open = async () => {
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await button(page, 'Guardia Infinita').waitFor();
    return page;
  };
  try {
    await body(await open(), open);
    assert.deepEqual(errors, []);
    console.log('PASS ' + name);
  } catch (error) {
    failures++;
    console.error('FAIL ' + name + '\n' + (error.stack ?? error));
  } finally {
    await context.close();
  }
}

try {
  console.log('Chrome ' + browser.version());
  await scenario('UX-001 stable commit before playback and reload at every boundary', async (page, open) => {
    await resume(page);
    await page.clock.install({ time: new Date(20000) });
    await page.clock.pauseAt(new Date(25000));
    await click(page, 'Finalizar Turno');
    const expected = expectedTurn(classic);
    assert.deepEqual((await current(page)).run, expected);
    for (const delay of [0, 30, 30, 520, 30, 520]) {
      await page.clock.runFor(delay);
      const reopened = await open();
      await resume(reopened);
      await button(reopened, 'Finalizar Turno').waitFor();
      assert.deepEqual((await current(reopened)).run, expected);
      await reopened.close();
    }
    const writes = await page.evaluate((main) => window.qaWrites.filter(([key]) => key === main), main);
    assert.equal(writes.length, 1);
    await settle(page);
    await page.close();
    const recovered = await open();
    await resume(recovered);
    assert.deepEqual((await current(recovered)).run, expected);
    await capture(recovered, '01-turno-restaurado');
  }, { fixture: save() });

  for (const [label, title, dialog] of [
    ['mazo', 'Ver mazo y pilas', /Visor de mazo/],
    ['inspector', 'Ver ficha médica y reglas', /Ficha médica/],
    ['pausa', 'Pausa (Esc)', /Duelo en Pausa/],
  ]) {
    await scenario('UX-002 suspension and focus ' + label, async (page) => {
      await resume(page);
      await page.clock.install({ time: new Date(20000) });
      await page.clock.pauseAt(new Date(25000));
      await click(page, 'Finalizar Turno');
      const control = page.getByTitle(title, { exact: true }).first();
      await control.click();
      const top = page.getByRole('dialog', { name: dialog });
      await page.clock.runFor(5000);
      assert.equal(await button(page, /Respuesta Brote/).count(), 0, 'background excluded from accessibility tree');
      assert.equal(await page.getByText('Respuesta Brote…', { exact: true }).count(), 1, 'playback remains at rival turn');
      await top.waitFor();
      for (const key of ['Tab', 'Shift+Tab', 'e', '1']) {
        await page.keyboard.press(key);
        assert.ok(await top.evaluate((node) => node.contains(document.activeElement)));
      }
      if (label === 'pausa') {
        await click(page, 'Ver Mazo');
        const deck = page.getByRole('dialog', { name: /Visor de mazo/ });
        await deck.getByRole('button', { name: /Macrófago/i }).first().click();
        await capture(page, '02-modales-apilados');
        await page.keyboard.press('Escape');
        await deck.waitFor();
        assert.match(await page.evaluate(() => document.activeElement.textContent), /Macrófago/);
        await page.keyboard.press('Escape');
        await top.waitFor();
        assert.match(await page.evaluate(() => document.activeElement.textContent), /Ver Mazo/);
        await page.clock.runFor(5000);
        assert.equal(await page.getByText('Respuesta Brote…', { exact: true }).count(), 1);
      }
      await page.keyboard.press('Escape');
      assert.ok(await control.evaluate((node) => node === document.activeElement));
      await page.clock.runFor(5000);
      await settle(page);
      assert.deepEqual((await current(page)).run, expectedTurn(classic));
    }, { fixture: save() });
  }

  await scenario('UX-003 cancel new mode and restart without touching either save', async (page) => {
    const before = [await get(page), await get(page, backup)];
    await page.keyboard.press('Enter');
    assert.deepEqual([await get(page), await get(page, backup)], before);
    await click(page, 'Guardia Infinita');
    const confirm = page.getByRole('dialog', { name: /Nueva partida|Reiniciar guardia/i });
    await confirm.waitFor();
    await capture(page, '03-confirmacion');
    await page.keyboard.press('Escape');
    assert.deepEqual([await get(page), await get(page, backup)], before);
    await resume(page);
    await page.getByTitle('Pausa (Esc)', { exact: true }).click();
    await click(page, 'Reiniciar Guardia');
    await confirm.waitFor();
    await confirm.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.deepEqual([await get(page), await get(page, backup)], before);
    await click(page, 'Reiniciar Guardia');
    await confirm.getByRole('button', { name: 'Confirmar', exact: true }).click();
    assert.equal(await page.evaluate((main) => window.qaWrites.filter(([key]) => key === main).length, main), 1);
  }, { fixture: save(), backupFixture: save() });

  await scenario('UX-011 denied write, visible retry and recover from corrupt primary', async (page) => {
    await resume(page);
    await click(page, 'Finalizar Turno');
    const status = page.getByRole('status').filter({ hasText: /No se pudo guardar/ });
    await status.waitFor();
    assert.deepEqual((await current(page)).run, classic);
    await capture(page, '04-error-guardado');
    await page.evaluate(() => { window.qaDenied = false; });
    await click(page, 'Reintentar guardado');
    await settle(page);
    assert.deepEqual((await current(page)).run, expectedTurn(classic));
    await page.evaluate((main) => localStorage.setItem(main, '{'), main);
    await page.reload();
    await page.getByText(/respaldo/i).first().waitFor();
    await resume(page);
    await button(page, 'Finalizar Turno').waitFor();
    await capture(page, '05-respaldo');
  }, { fixture: save(), deny: true });
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
