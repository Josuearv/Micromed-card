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
const json = (value) => JSON.parse(JSON.stringify(value));
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
const pauseClock = async (page) => {
  await page.clock.install({ time: new Date(20000) });
  await page.clock.pauseAt(new Date(25000));
};
const nearVictory = (run) => {
  const duel = run.duelState;
  const card = duel.hand.find((entry) => entry.kind === 'Unidad');
  const board = resolvePlayCard(duel, card.uid, 0, run.rival).nextState;
  return {
    ...run, rngState: board.rngState, idSequence: board.idSequence,
    duelState: { ...board, rivalLp: 1, enemySlots: [null, null, null] },
  };
};
const win = async (page) => {
  await click(page, 'Ir a Combate');
  await click(page, /Atacar Directo al Brote/);
};
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
  for (const method of ['reload', 'close', 'menu']) {
    await scenario('UX-001 stable commit at every boundary: ' + method, async (first, open) => {
      const expected = expectedTurn(classic);
      const boundaries = [0, 30, 60, 580, 610, 1130];
      let page = first;
      for (const time of boundaries) {
        await resume(page);
        await pauseClock(page);
        await click(page, 'Finalizar Turno');
        assert.deepEqual((await current(page)).run, expected);
        await page.clock.runFor(time);
        assert.equal(await page.evaluate((main) => window.qaWrites.filter(([key]) => key === main).length, main), 1);
        if (method === 'reload') {
          await page.reload();
          // Unpause the browser clock so controls can settle after navigation.
          await page.clock.resume();
        } else if (method === 'close') {
          await page.close();
          page = await open();
        } else {
          await page.getByTitle('Pausa (Esc)', { exact: true }).click();
          await click(page, 'Volver al Menú Principal');
          await page.clock.resume();
        }
        await resume(page);
        await button(page, 'Finalizar Turno').waitFor();
        assert.deepEqual((await current(page)).run, expected);
        if (method === 'reload' && time === 60) await capture(page, '01-turno-restaurado');
        if (time !== boundaries.at(-1)) {
          await page.evaluate(({ main, raw }) => localStorage.setItem(main, raw), { main, raw: JSON.stringify(save()) });
          await page.close();
          page = await open();
        }
      }
    }, { fixture: save() });
  }

  for (const [label, title, dialog] of [
    ['mazo', 'Ver mazo y pilas', /Visor de mazo/],
    ['inspector', 'Ver ficha médica y reglas', /Ficha médica/],
    ['pausa', 'Pausa (Esc)', /Duelo en Pausa/],
  ]) {
    await scenario('UX-002 suspension and focus ' + label, async (page) => {
      await resume(page);
      await pauseClock(page);
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
    assert.deepEqual((await current(page)).run, json(classic));
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

  const combatFixture = nearVictory(classic);
  for (const phase of ['PREPARACION', 'COMBATE']) {
    await scenario('UX-002 modals in ' + phase, async (page) => {
      await resume(page);
      const before = await get(page);
      const opener = page.getByTitle('Ver mazo y pilas', { exact: true });
      await opener.click();
      const deck = page.getByRole('dialog', { name: /Visor de mazo/ });
      await deck.waitFor();
      await page.keyboard.press('e');
      await page.keyboard.press('1');
      assert.equal(await get(page), before);
      await page.keyboard.press('Escape');
      assert.ok(await opener.evaluate((node) => node === document.activeElement));
      await page.getByTitle('Ver ficha médica y reglas', { exact: true }).first().click();
      await page.getByRole('dialog', { name: /Ficha médica/ }).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await get(page), before);
    }, { fixture: save({ ...combatFixture, duelState: { ...combatFixture.duelState, phase } }) });
  }

  const oldInterrupted = save({ ...classic, duelState: { ...classic.duelState, phase: 'TURNO_RIVAL' } });
  await scenario('UX-001 legacy interruption with an earlier same-run checkpoint', async (page) => {
    await page.getByRole('status').filter({ hasText: /respaldo/ }).waitFor();
    const before = [await get(page), await get(page, backup)];
    await resume(page);
    await button(page, 'Finalizar Turno').waitFor();
    assert.deepEqual([await get(page), await get(page, backup)], before);
  }, { fixture: oldInterrupted, backupFixture: save() });

  await scenario('UX-001 legacy interruption without a safe checkpoint preserves data', async (page) => {
    const before = [await get(page), await get(page, backup)];
    await page.getByRole('status').filter({ hasText: /No se pudo recuperar/ }).waitFor();
    assert.equal(await button(page, /^Continuar \(/).count(), 0);
    await click(page, 'Guardia Infinita');
    await click(page, 'Cancelar');
    assert.deepEqual([await get(page), await get(page, backup)], before);
  }, { fixture: oldInterrupted, backupFixture: oldInterrupted });

  await scenario('UX-011 unsaved in-memory progress survives returning to the menu', async (page) => {
    await resume(page);
    await click(page, 'Finalizar Turno');
    await page.getByTitle('Pausa (Esc)', { exact: true }).click();
    await page.getByRole('status').filter({ hasText: /No se pudo guardar/ }).waitFor();
    await click(page, 'Volver al Menú Principal');
    await click(page, /^Continuar sin guardar/);
    await button(page, 'Finalizar Turno').waitFor();
    await page.evaluate(() => { window.qaDenied = false; });
    await click(page, 'Reintentar guardado');
    assert.deepEqual((await current(page)).run, expectedTurn(classic));
  }, { fixture: save(), deny: true });

  const endless = startNewRun('endless', 12345);
  const weakened = { ...endless, playerLp: 1400, duelState: { ...endless.duelState, playerLp: 1400 } };
  await scenario('V3 infinite rewards, partial recovery, record and next guard', async (page) => {
    await resume(page);
    await win(page);
    const summary = await current(page);
    assert.equal(summary.inRoundSummary, true);
    assert.equal(summary.recoveredLp, 1300);
    assert.equal(await get(page, 'codigo_vital_best_guard_v3'), '1');
    assert.deepEqual(summary.run, json(transitionRunOnVictory({
      ...nearVictory(weakened), duelState: summary.run.duelState,
      idSequence: summary.run.duelState.idSequence, rngState: summary.run.duelState.rngState,
    }).nextRun));
    await page.reload();
    await resume(page);
    await page.getByRole('heading', { name: /Neutralizado/ }).waitFor();
    await capture(page, '06-recompensas-restauradas');
    const chosen = summary.run.rewardChoices[0];
    await click(page, chosen.name + '. Coste ' + chosen.cost + '. ' + chosen.shortRule);
    assert.deepEqual((await current(page)).run, json(advanceToNextGuard(summary.run, chosen)));
  }, { fixture: save(nearVictory(weakened)) });

  const lastClassic = advanceToNextGuard(advanceToNextGuard(classic, null), null);
  for (const [terminal, heading, fixture] of [
    ['VICTORY', /Victoria Clínica Total/, nearVictory({ ...lastClassic, duelsWon: 2 })],
    ['GAME_OVER', /Estabilidad del Paciente Agotada/, { ...classic, playerLp: 1, duelState: { ...classic.duelState, playerLp: 1 } }],
  ]) {
    await scenario('V3 terminal reload ' + terminal, async (page) => {
      await resume(page);
      if (terminal === 'VICTORY') await win(page);
      else await click(page, 'Finalizar Turno');
      const outcome = await current(page);
      assert.equal(outcome.terminal, terminal);
      await page.reload();
      await click(page, /^Ver resultado \(/);
      await page.getByRole('heading', { name: heading }).waitFor();
      assert.deepEqual(await current(page), outcome);
      await capture(page, terminal === 'VICTORY' ? '07-victoria-restaurada' : '08-derrota-restaurada');
    }, { fixture: save(fixture) });
  }

  await scenario('V3 3D turn and 2D fallback after context loss', async (page) => {
    await resume(page);
    const canvas = page.locator('canvas').last();
    await canvas.waitFor();
    await click(page, 'Finalizar Turno');
    await settle(page);
    const lost = await canvas.evaluate((node) => {
      const extension = node.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      extension?.loseContext();
      return Boolean(extension);
    });
    assert.equal(lost, true);
    await canvas.waitFor({ state: 'detached' });
    await capture(page, '09-webgl-fallback');
    const initial = (await current(page)).run;
    await click(page, 'Finalizar Turno');
    assert.deepEqual((await current(page)).run, expectedTurn(initial));
  }, { fixture: save(), three: true });
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
