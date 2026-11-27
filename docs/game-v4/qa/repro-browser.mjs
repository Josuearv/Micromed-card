import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "../../../node_modules/.qa/node_modules/playwright-core";
import { advanceToNextGuard } from "../../../src/engine/runEngine";
import { classic, defeat, finale, nearVictory, organs, snapshot, unit } from "./repro-domain.mjs";
const root = new URL("./screenshots/", import.meta.url);
const saveKey = "codigo_vital_save_v3";
const backupKey = "codigo_vital_backup_v3";
const origin = process.env.QA_ORIGIN ?? "http://127.0.0.1:4170";
const chrome = process.env.QA_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
console.log(JSON.stringify({ chrome: browser.version(), origin, rendering: "SwiftShader" }));
let failures = 0;
const evidence = (id, details) => console.log(JSON.stringify({ id, ...details }));
const button = (page, name) => page.getByRole("button", { name, exact: typeof name === "string" });
const read = (page, key = saveKey) => page.evaluate((key) => localStorage.getItem(key), key);
const saved = async (page) => JSON.parse(await read(page));
const shot = async (page, name) => {
  await Bun.write(new URL(name + ".png", root), await page.screenshot({ timeout: 15000 }));
  evidence("SCREENSHOT", { name, viewport: page.viewportSize() });
};
const open = async (context, options = {}) => {
  const page = await context.newPage();
  page.on("pageerror", (error) => evidence("PAGE_ERROR", { message: error.message }));
  page.on("response", (response) => {
    if (response.status() >= 400)
      evidence("HTTP_ERROR", { status: response.status(), url: response.url() });
  });
  await page.addInitScript(({ options, saveKey, backupKey }) => {
    if (!sessionStorage.getItem("qa-initialized")) {
      if (options.run)
        localStorage.setItem(saveKey, typeof options.run === "string" ? options.run : JSON.stringify(options.run));
      if (options.backup)
        localStorage.setItem(backupKey, JSON.stringify(options.backup));
      localStorage.setItem("codigo_vital_prefs_v3", JSON.stringify({
        tactical2D: options.tactical2D ?? true,
        speedMode: "normal",
        muted: true,
        reducedMotion: false
      }));
      sessionStorage.setItem("qa-initialized", "yes");
    }
    if (options.denyWrites) {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === saveKey || key === backupKey)
          throw new DOMException("QA write denied", "QuotaExceededError");
        return original.call(this, key, value);
      };
    }
    if (options.noWebGL) {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type.startsWith("webgl") ? null : Reflect.apply(original, this, [type, ...args]);
      };
    }
    Date.now = () => 12345;
    Math.random = () => 0;
  }, { options, saveKey, backupKey });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await button(page, "Guardia Infinita").waitFor();
  return page;
};
const resume = (page) => button(page, /^Continuar \(/).click();
const phase = (page) => button(page, "Finalizar Turno");
const awaitPrep = async (page) => {
  await phase(page).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Finalizar Turno" && !b.disabled));
};
async function scenario(name, run, viewport = { width: 1366, height: 768 }) {
  if (process.env.QA_SCENARIO && !name.includes(process.env.QA_SCENARIO))
    return;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  context.setDefaultTimeout(6500);
  try {
    await run(context);
  } catch (error) {
    failures++;
    evidence("SCENARIO_ERROR", { name, message: String(error) });
  } finally {
    await context.close();
  }
}
try {
  await scenario("Pantallas y fases", async (context) => {
    const page = await open(context);
    await shot(page, "01-menu-modos-ajustes");
    await button(page, "Modo Clásico (3 Duelos)").click();
    const first = await saved(page);
    assert.equal(first.run.seed, 12345);
    await shot(page, "02-preparacion-2d-tutorial");
    await page.getByLabel("Mano de cartas").getByRole("button", { name: new RegExp(unit.name) }).first().click();
    await shot(page, "03-preparacion-seleccion");
    await button(page, "+ Desplegar C1").click();
    await button(page, "Ir a Combate").click();
    await shot(page, "04-combate");
    await page.getByTitle("Historial clínico", { exact: true }).click();
    await shot(page, "05-historial");
    await button(page, "Cerrar historial").click();
    await page.getByTitle("Pausa (Esc)", { exact: true }).click();
    await button(page, "Reanudar Duelo").waitFor();
    await shot(page, "06-pausa");
    await button(page, "Ver Mazo").click();
    const deck = page.getByRole("dialog", { name: "Visor de mazo y pilas clínicas" });
    await deck.waitFor();
    await shot(page, "07-mazo");
    await deck.getByRole("button", { name: /Macrófago|Linfocito|Anticuerpo|Célula|Desfibrilador/i }).first().click();
    await page.getByRole("dialog", { name: /Ficha médica/ }).waitFor();
    await shot(page, "08-inspector-sobre-mazo");
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => ({
      label: document.activeElement?.getAttribute("aria-label"),
      topDialog: document.activeElement?.closest('[role="dialog"]')?.getAttribute("aria-label"),
    }));
    const dialogsBefore = await page.getByRole("dialog").count();
    await page.keyboard.press("Escape");
    const dialogsAfter = await page.getByRole("dialog").count();
    const inspector = page.getByRole("dialog", { name: /Ficha médica/ });
    evidence("UX-004", { dialogsBefore, dialogsAfter, focus, inspectorRemains: await inspector.isVisible(), deckRemains: await deck.isVisible() });
    if (await inspector.isVisible()) await button(page, "Cerrar ficha médica").click();
    if (await deck.isVisible()) await button(page, "Cerrar visor de mazo").click();
    await button(page, "Volver al Menú Principal").click();
    await shot(page, "09-menu-continuar");
    const before = await read(page);
    await page.keyboard.press("Enter");
    const after = await saved(page);
    assert.equal(after.run.mode, "endless");
    assert.equal(await read(page, backupKey), before);
    evidence("UX-003", { before: "classic", after: after.run.mode, trigger: "Enter del menú", priorBytesInBackup: true });
    await shot(page, "10-guardia-infinita");
    await page.getByTitle("Pausa (Esc)", { exact: true }).click();
    await button(page, "Volver al Menú Principal").click();
    await button(page, "Modo Clásico (3 Duelos)").click();
    assert.equal((await saved(page)).run.mode, "classic");
    evidence("UX-003", { trigger: "clic en modo clásico", after: "classic", intermediateConfirmation: false });
    await phase(page).click();
    await awaitPrep(page);
    const turnBeforeRestart = (await saved(page)).run.duelState.turn;
    await page.getByTitle("Pausa (Esc)", { exact: true }).click();
    await button(page, "Reiniciar Guardia").click();
    const turnAfterRestart = (await saved(page)).run.duelState.turn;
    assert.equal(turnAfterRestart, 1);
    evidence("UX-003", { trigger: "Reiniciar Guardia", turnBeforeRestart, turnAfterRestart });
  });
  await scenario("Recarga y cierre de pestaña por frontera", async (context) => {
    const page = await open(context, { run: snapshot() });
    await resume(page);
    await page.evaluate((saveKey) => {
      const original = Storage.prototype.setItem;
      const probe = window;
      probe.qaWrites = [];
      Storage.prototype.setItem = function(key, value) {
        if (key === saveKey)
          probe.qaWrites.push(value);
        return original.call(this, key, value);
      };
    }, saveKey);
    await page.clock.install({ time: new Date(20000) });
    await page.clock.pauseAt(new Date(25000));
    await phase(page).click();
    await page.clock.runFor(50);
    await button(page, /Respuesta Brote/).waitFor();
    await shot(page, "11-turno-rival");
    await page.clock.runFor(8000);
    const writes = await page.evaluate(() => window.qaWrites);
    assert.ok(writes.length > 3);
    for (const [index, raw] of writes.entries()) {
      const check = await open(context, { run: raw });
      const persisted = JSON.parse(raw).run;
      await resume(check);
      const rivalCTA = button(check, /Respuesta Brote/);
      const frozenCTA = await rivalCTA.count() > 0 && await rivalCTA.isDisabled();
      if (index === 1) {
        await check.reload({ waitUntil: "domcontentloaded" });
        await resume(check);
        await shot(check, "12-turno-rival-bloqueado-tras-recarga");
        assert.equal((await saved(check)).run.duelState.turn, persisted.duelState.turn);
      }
      evidence("UX-001", {
        index,
        phase: persisted.duelState.phase,
        turn: persisted.duelState.turn,
        turnsElapsed: persisted.turnsElapsed,
        playerLp: persisted.duelState.playerLp,
        rivalLp: persisted.duelState.rivalLp,
        rng: persisted.duelState.rngState,
        frozenCTA
      });
      await check.close();
    }
  });
  await scenario("Playback y modales", async (context) => {
    for (const modal of ["mazo", "inspector", "pausa"]) {
      const page = await open(context, { run: snapshot() });
      await resume(page);
      await page.clock.install({ time: new Date(20000) });
      await page.clock.pauseAt(new Date(25000));
      await phase(page).click();
      await page.clock.runFor(50);
      const before = await saved(page);
      const control = {
        mazo: "Ver mazo y pilas",
        inspector: "Ver ficha médica y reglas",
        pausa: "Pausa (Esc)"
      }[modal];
      await page.getByTitle(control, { exact: true }).first().click();
      await shot(page, "13-rival-" + modal);
      await page.clock.runFor(8000);
      const after = await saved(page);
      assert.equal(after.run.duelState.turn, modal === "pausa" ? before.run.duelState.turn : before.run.duelState.turn + 1);
      evidence("UX-002", { modal, turnBefore: before.run.duelState.turn, turnAfter: after.run.duelState.turn, lp: [before.run.playerLp, after.run.playerLp] });
      if (modal === "pausa") {
        await button(page, "Reanudar Duelo").click();
        await page.clock.runFor(8000);
        assert.equal((await saved(page)).run.duelState.turn, before.run.duelState.turn + 1);
      }
      await page.close();
    }
  });
  await scenario("Persistencia", async (context) => {
    const page = await open(context, { denyWrites: true });
    await button(page, "Guardia Infinita").click();
    await awaitPrep(page);
    assert.equal(await read(page), null);
    const reported = await page.getByText(/error de guardado|no se pudo guardar|sin guardar/i).count();
    assert.equal(reported, 0);
    await page.getByTitle("Pausa (Esc)", { exact: true }).click();
    await button(page, "Volver al Menú Principal").click();
    assert.equal(await button(page, /^Continuar \(/).count(), 0);
    await shot(page, "14-menu-storage-denegado");
    evidence("UX-011", { writeDenied: true, save: null, reported, continue: false });
    await page.close();
    const corrupt = await open(context, { run: "{", backup: snapshot() });
    await resume(corrupt);
    await awaitPrep(corrupt);
    assert.equal(await read(corrupt), "{");
    evidence("UX-011", { malformedPrimary: true, backupResumed: true, corruptPrimaryUnchanged: true });
    await corrupt.close();
    const invalid = snapshot();
    invalid.run = { ...classic, duelState: { ...classic.duelState, playerSlots: [] } };
    const weak = await open(context, { run: invalid, backup: snapshot() });
    assert.equal(await button(weak, /^Continuar \(/).count(), 1);
    evidence("UX-011", { invalidPrimary: "playerSlots vacío", offersContinue: true });
  });
  await scenario("Resultados", async (context) => {
    for (const [run, name, title] of [
      [nearVictory(), "15-estabilizacion-recompensas", /Neutralizado/],
      [finale, "16-victoria-clasica", /Victoria Clínica Total/],
      [defeat, "17-derrota", /Estabilidad del Paciente Agotada/]
    ]) {
      const page = await open(context, { run: snapshot(run) });
      await resume(page);
      if (run.duelState.rivalLp === 1) {
        await button(page, "Ir a Combate").click();
        await button(page, /Atacar Directo al Brote/).click();
      } else {
        await phase(page).click();
      }
      await page.getByRole("heading", { name: title }).waitFor();
      await shot(page, name);
      if (name.startsWith("15")) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await resume(page);
        await page.getByRole("heading", { name: title }).waitFor();
        const rewards = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: title }) });
        await rewards.getByTitle("Ver fundamento médico y sinergias", { exact: true }).first().click();
        await shot(page, "18-recompensa-inspector");
        await page.keyboard.press("Escape");
        const persisted = await saved(page);
        const chosen = persisted.run.rewardChoices[0];
        await rewards.getByRole("button", { name: chosen.name + ". Coste " + chosen.cost + ". " + chosen.shortRule, exact: true }).click();
        const next = await saved(page);
        const expected = JSON.parse(JSON.stringify(advanceToNextGuard(persisted.run, chosen)));
        assert.deepEqual(next.run, expected);
        await shot(page, "19-siguiente-guardia");
        evidence("UX-016", { chosen: chosen.id, guardBefore: persisted.run.guardLevel, guardAfter: next.run.guardLevel, directClick: true });
      }
      await page.close();
    }
  });
  for (const [id, run] of organs) {
    await scenario("Órgano " + id, async (context) => {
      const page = await open(context, { run: snapshot(run), tactical2D: false });
      await resume(page);
      await page.locator("canvas").last().waitFor();
      await page.getByTitle("Vistas 3D / 2D (H)", { exact: true }).click();
      const modes = page.getByTitle("Alternar tablero táctico 2D accesible", { exact: true });
      await shot(page, "organo-" + id + "-3d-arena");
      await page.getByRole("button", { name: / 3D$/ }).click();
      if (id === "higado")
        await button(page, "Instrumental").click();
      await page.getByRole("button", { name: / 3D$/ }).click();
      await page.waitForTimeout(650);
      await shot(page, "organo-" + id + "-3d-detalle");
      await modes.click();
      await shot(page, "organo-" + id + "-2d");
      evidence("UX-019", { organ: id, seed: run.seed });
    });
  }
  await scenario("Fallback sin WebGL", async (context) => {
    const page = await open(context, { run: snapshot(), tactical2D: false, noWebGL: true });
    await resume(page);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("codigo_vital_prefs_v3") ?? "{}").tactical2D);
    assert.equal(await page.locator("canvas").count(), 0);
    await shot(page, "20-webgl-no-disponible");
    const feedbackVisible = await page.getByText(/WebGL no disponible/).first().isVisible();
    await phase(page).click();
    evidence("WEBGL", { initialized2DFallback: true, phaseAction: true, feedbackVisible });
  });
  await scenario("Rendimiento y pérdida de contexto", async (context) => {
    const perf = await context.newPage();
    await perf.route("**/src/components/MedicalTableCanvas.tsx*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const telemetry = "const tel = telemetryRef.current;";
      const render = "renderer.render(scene, camera);";
      assert.ok(source.includes(telemetry) && source.includes(render));
      await route.fulfill({
        response,
        body: source.replace(telemetry, "const tel = { ...telemetryRef.current, organId: window.qaOrgan ?? telemetryRef.current.organId };").replace(render, render + " window.qaFrames ??= []; window.qaFrames.push({ t: performance.now(), organ: activeOrganRig.organId, ...renderer.info.render, ...renderer.info.memory });")
      });
    });
    await perf.goto(origin, { waitUntil: "domcontentloaded" });
    await button(perf, "Modo Clásico (3 Duelos)").click();
    await perf.waitForFunction("window.qaFrames?.length > 10", undefined, { timeout: 25000 });
    const graphics = await perf.locator("canvas").last().evaluate((canvas) => {
      const gl = canvas.getContext("webgl2");
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        dimensions: [canvas.width, canvas.height],
        renderer: gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
        deviceMemoryGiB: Reflect.get(navigator, "deviceMemory"),
        jsHeapBytes: Reflect.get(performance, "memory")?.usedJSHeapSize
      };
    });
    const sample = async () => {
      await perf.evaluate("window.qaFrames.length = 0");
      await perf.waitForFunction("window.qaFrames?.length >= 45", undefined, { timeout: 25000 });
      return perf.evaluate(() => {
        const frames = Reflect.get(window, "qaFrames");
        const deltas = frames.slice(1).map((entry, index) => entry.t - frames[index].t).sort((a, b) => a - b);
        const p = (percent) => deltas[Math.ceil(deltas.length * percent) - 1];
        return {
          frames: frames.length,
          fps: 1000 * deltas.length / deltas.reduce((sum, n) => sum + n, 0),
          p50ms: p(0.5),
          p95ms: p(0.95),
          last: frames.at(-1),
          jsHeapBytes: Reflect.get(performance, "memory")?.usedJSHeapSize
        };
      });
    };
    const order = [...organs.keys()];
    const firstOrgan = classic.rival.organId;
    const startIndex = order.indexOf(firstOrgan);
    const before = await sample();
    const swaps = [];
    for (let index = 1;index <= 20; index++) {
      const organ = order[(startIndex + index) % order.length];
      await perf.evaluate((id) => Reflect.set(window, "qaOrgan", id), organ);
      await perf.waitForFunction((id) => Reflect.get(window, "qaFrames")?.at(-1)?.organ === id, organ);
      swaps.push(await perf.evaluate(() => Reflect.get(window, "qaFrames").at(-1)));
    }
    const after = await sample();
    evidence("PERF", { graphics, before, after, swaps });
    const lost = await perf.locator("canvas").last().evaluate((canvas) => {
      const extension = canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context");
      extension?.loseContext();
      return !!extension;
    });
    assert.ok(lost, "WEBGL_lose_context disponible");
    await perf.waitForFunction(() => JSON.parse(localStorage.getItem("codigo_vital_prefs_v3") ?? "{}").tactical2D);
    await shot(perf, "21-webgl-contexto-perdido");
    evidence("WEBGL", { contextLoss: true, recoveredTo2D: true, canvasRemoved: await perf.locator("canvas").count() === 0 });
  });
  for (const [width, height] of [[360, 800], [390, 844], [768, 1024], [1366, 768], [1920, 1080], [800, 360]]) {
    await scenario("Viewport " + width + "x" + height, async (context) => {
      const page = await open(context, { run: snapshot() });
      await resume(page);
      await awaitPrep(page);
      await shot(page, "viewport-" + width + "x" + height);
      const cta = await phase(page).boundingBox();
      const rival = await page.getByText("LP " + classic.duelState.rivalLp, { exact: true }).first().isVisible();
      evidence("RESPONSIVE", { width, height, cta, rivalLabelVisible: rival });
    }, { width, height });
  }
} finally {
  await browser.close();
}
evidence("RESULT", { scenarioFailures: failures });
process.exitCode = failures ? 1 : 0;
