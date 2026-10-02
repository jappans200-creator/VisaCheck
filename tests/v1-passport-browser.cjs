// Optional dependency-free visual regression check. Requires the static site on
// :8765 and Chrome on :9222. Screenshots are review artifacts outside the repo.
// Synthetic scores below exercise presentation only; the real scoring pipeline
// runs separately and is never replaced or changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { complete } = require('./v1-form-fixtures.cjs');

(async () => {
  const screenshotDir = '/tmp/visacheck-passport-review';
  fs.mkdirSync(screenshotDir, { recursive: true });
  const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = pages.find(p => p.type === 'page');
  assert.ok(page, 'Chrome must have a page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let next = 0;
  const pending = new Map(), errors = [], failed = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      message.error ? request.reject(message.error) : request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
    else if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) failed.push(message.params.response.url);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out: ' + expression);
  };
  const frame = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const screenshot = async name => {
    await frame();
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotDir, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  const fill = values => evaluate(`(() => {
    for (const [id, value] of Object.entries(${JSON.stringify(values)})) {
      const input = document.getElementById(id);
      if (input) input.value = value;
    }
    document.getElementById('check-form').dispatchEvent(new Event('change', {bubbles: true}));
  })()`);
  const visibleReport = async () => {
    const result = await evaluate(`(() => {
      const out = document.getElementById('results'), style = getComputedStyle(out), box = out.getBoundingClientRect();
      const panels = [...out.querySelectorAll('.report-section')];
      const cover = out.querySelector('.report-cover');
      const stamp = out.querySelector('.score-stamp');
      return {
        hidden: out.hidden, display: style.display, visibility: style.visibility,
        width: box.width, height: box.height, textLength: out.innerText.trim().length,
        coverHeight: cover?.getBoundingClientRect().height,
        coverBackground: cover && getComputedStyle(cover).backgroundColor,
        backgrounds: panels.map(panel => getComputedStyle(panel).backgroundColor),
        sections: panels.map(panel => ({title: panel.querySelector('h3').textContent, height: panel.getBoundingClientRect().height})),
        community: out.querySelector('.community-metric')?.textContent,
        stamp: stamp && {label: stamp.querySelector('.stamp-label')?.textContent, value: stamp.querySelector('.stamp-value')?.textContent, classes: stamp.className, width: stamp.getBoundingClientRect().width, height: stamp.getBoundingClientRect().height},
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        sourceLinks: out.querySelectorAll('.source-link').length,
        sourceDetails: [...out.querySelectorAll('.source-link')].some(link => {const details = link.closest('details'); return details && !details.open;}),
        status: document.getElementById('form-status').textContent
      };
    })()`);
    assert.equal(result.hidden, false);
    assert.notEqual(result.display, 'none');
    assert.ok(!['hidden', 'collapse'].includes(result.visibility));
    assert.ok(result.width > 0 && result.height > 0 && result.textLength > 0, 'Report must actually occupy visible space');
    assert.ok(result.coverHeight > 0 && result.sections.every(section => section.height > 0));
    assert.equal(result.overflow, false, 'Report must not cause horizontal scrolling');
    assert.ok(result.stamp && result.stamp.width > 0 && result.stamp.height > 0);
    const lightPaper = value => {
      const channels = value?.match(/[\d.]+/g)?.map(Number);
      return channels && channels.slice(0, 3).every(channel => channel >= 235) && (channels.length < 4 || channels[3] === 1);
    };
    assert.ok(lightPaper(result.coverBackground), 'Report cover must use white/off-white paper');
    assert.ok(result.backgrounds.every(lightPaper), 'Every report section must use white/off-white paper');
    for (const title of ['A. Official Eligibility Checks', 'B. Application Readiness', 'C. Historical / Community Context', 'D. How to Strengthen Your Application', 'E. Application Checklist / Next Steps']) {
      assert.ok(result.sections.some(section => section.title === title), title);
    }
    assert.ok(result.sourceLinks > 0 && result.sourceDetails, 'Official sources must remain available in expandable details');
    return result;
  };
  const submit = async () => {
    await evaluate("document.getElementById('check-form').requestSubmit()");
    await until("/Report ready|could not/.test(document.getElementById('form-status').textContent)");
    const result = await visibleReport();
    assert.match(result.status, /Report ready/);
    assert.ok(await evaluate('window.__passportLast.report.legal.length > 0'));
    return result;
  };
  const reportTop = () => evaluate("document.getElementById('results').scrollIntoView({block: 'start', behavior: 'instant'})");
  const fixture = async (percent, snapshot = 'normal') => {
    await evaluate(`(() => {
      const saved = window.__passportSnapshots[${JSON.stringify(snapshot)}];
      const out = document.getElementById('results');
      const community = {...saved.community, statistics: {percent: ${percent}, sampleSize: 10}, message: 'Presentation fixture: sample community percentage for visual review only.'};
      window.__passportRender(out, saved.report, saved.sources, community);
      out.hidden = false;
      const caption = document.createElement('p');
      caption.textContent = 'Presentation fixture · sample score ${percent} / 100 · not a calculated applicant score';
      caption.className = 'presentation-fixture';
      caption.style.cssText = 'padding:10px;border:1px dashed #6b7280;color:#374151;background:#fff;font:600 13px/1.5 system-ui;';
      out.querySelector('.report-cover').prepend(caption);
    })()`);
    await reportTop();
    return visibleReport();
  };

  try {
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'about:blank' });
    await until("location.href === 'about:blank' && document.readyState === 'complete'");
    await send('Page.navigate', { url: 'http://127.0.0.1:8765/check.html' });
    await until("document.readyState === 'complete' && document.querySelector('#irp') !== null");
    await screenshot('initial-checker');
    assert.equal(await evaluate('VisaCheckV1Fields.length'), 35, 'Questionnaire definitions remain unchanged');
    // Real keyboard event: select becomes focused and has a visible focus ring.
    await evaluate("document.querySelector('.form-section summary').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const focus = await evaluate(`(() => {const e = document.activeElement, s = getComputedStyle(e); return {id: e.id, visible: e.matches(':focus-visible'), outline: s.outlineStyle, width: parseFloat(s.outlineWidth)};})()`);
    assert.equal(focus.id, 'nationality');
    assert.equal(focus.visible, true);
    assert.notEqual(focus.outline, 'none');
    assert.ok(focus.width > 0);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.ok(await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches && [...document.querySelectorAll('main, .checker-card, .form-section')].every(e => getComputedStyle(e).animationDuration.split(',').every(t => parseFloat(t) <= 0.01))`), 'Opening animation must respect reduced motion');
    await send('Emulation.setEmulatedMedia', { features: [] });
    await evaluate(`(() => {
      const render = VisaCheckV1Report.render;
      window.__passportRender = render;
      window.__passportSnapshots = {};
      VisaCheckV1Report.render = (target, report, sources, community) => {
        window.__passportLast = {report, sources, community};
        return render(target, report, sources, community);
      };
    })()`);
    await fill(complete());
    await evaluate(`(() => {
      const sections = [...document.querySelectorAll('.form-section')];
      sections.forEach(section => {section.open = true;});
      document.getElementById('entry').closest('.form-section').scrollIntoView({block: 'start', behavior: 'instant'});
    })()`);
    await screenshot('mid-questionnaire');
    const normal = await submit();
    await until('window.__passportLast.community.statistics !== undefined');
    await evaluate('window.__passportSnapshots.normal = window.__passportLast');
    const actual = await evaluate('({route: window.__passportLast.report.route.status, legalResults: window.__passportLast.report.legal.length, statistics: window.__passportLast.community.statistics})');
    assert.equal(actual.route, 'SUPPORTED');
    await reportTop();
    await screenshot('normal-report');
    const originalReport = await evaluate('JSON.stringify(window.__passportSnapshots.normal.report)');

    const green = await fixture(82);
    assert.match(green.stamp.classes, /stamp-amber/);
    assert.equal(green.stamp.label, 'CHECK REQUIRED');
    assert.match(green.community, /82 \/ 100/);
    await screenshot('green-report');
    const amber = await fixture(75);
    assert.match(amber.stamp.classes, /stamp-amber/);
    assert.equal(amber.stamp.label, 'CHECK REQUIRED');
    await screenshot('amber-report');
    assert.match((await fixture(50)).stamp.classes, /stamp-amber/);
    const red = await fixture(45);
    assert.match(red.stamp.classes, /stamp-amber/);
    assert.equal(red.stamp.label, 'CHECK REQUIRED');
    await screenshot('red-report');
    assert.equal(await evaluate('JSON.stringify(window.__passportSnapshots.normal.report)'), originalReport, 'Presentation fixtures must not mutate official results');

    // Produce the FAIL using the real evaluator; only the displayed community
    // score is a labeled fixture for this separation/regression example.
    await fill({ pages: '0' });
    await submit();
    await evaluate('window.__passportSnapshots.failure = window.__passportLast');
    assert.ok(await evaluate("window.__passportSnapshots.failure.report.legal.some(r => r.rule_id === 'SCHENGEN_TRAVEL_DOCUMENT_BLANK_PAGES' && r.status === 'FAIL')"));
    await fixture(82, 'failure');
    const alert = await evaluate(`(() => {
      const a = document.querySelector('.official-alert'), stamp = document.querySelector('.score-stamp');
      if (!a) return null;
      const r = a.getBoundingClientRect(), s = stamp.getBoundingClientRect();
      return {text: a.parentElement.innerText, primary:stamp.querySelector('.stamp-label').textContent, width: r.width, height: r.height, sameCover: a.closest('.report-cover') === stamp.closest('.report-cover'), gap: Math.max(0, r.top - s.bottom), display: getComputedStyle(a).display};
    })()`);
    assert.ok(alert && alert.width > 0 && alert.height > 0 && alert.display !== 'none');
    assert.match(alert.text, /Requirement not met/);
    assert.match(alert.text, /Blank passport pages/);
    assert.match(alert.text, /FAIL/);
    assert.equal(alert.primary, 'REQUIREMENT NOT MET', 'Official failure must control the primary stamp');
    await screenshot('high-score-official-fail');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await frame();
    const mobile = await visibleReport();
    assert.ok(mobile.width <= 390 && mobile.stamp.width < 390);
    const clipped = await evaluate(`(() => {
      const nodes = [...document.querySelectorAll('#results .report-cover, #results .score-stamp, #results .official-alert, #results .report-section')];
      return nodes.filter(e => {const r = e.getBoundingClientRect(); return r.left < -1 || r.right > window.innerWidth + 1;}).map(e => e.className);
    })()`);
    assert.deepEqual(clipped, [], 'Report components must fit inside the mobile viewport');
    await reportTop();
    await screenshot('mobile-report');

    await evaluate("document.getElementById('check-form').reset()");
    await new Promise(resolve => setTimeout(resolve, 30));
    await fill({ nationality: 'IN', residence: 'IE', document: 'ordinary', destination: 'FR', purpose: 'tourism', age: '30', special: 'no' });
    const unknown = await submit();
    assert.equal(await evaluate('window.__passportLast.report.route.status'), 'PARTIAL');
    assert.ok(await evaluate("window.__passportLast.report.legal.some(r => r.status === 'UNKNOWN')"));
    assert.match(await evaluate("document.getElementById('results').innerText"), /UNKNOWN/);
    await reportTop();
    await screenshot('unknown-report');

    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:8765/index.html' });
    await until("document.readyState === 'complete' && location.pathname === '/index.html'");
    await screenshot('home');
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
    assert.deepEqual(errors, [], 'No uncaught exceptions or application console errors');
    assert.deepEqual(failed.filter(url => !url.endsWith('favicon.ico')), [], 'No failed application resources');
    console.log(JSON.stringify({ result: 'PASS', actualEvaluation: actual, normalReport: {width: normal.width, height: normal.height}, unknownReport: {width: unknown.width, height: unknown.height}, presentationFixtures: ['82/75/50/45 secondary with CHECK REQUIRED', '82 secondary with REQUIREMENT NOT MET'], desktop: '1280px', mobile: '390px; no clipping or horizontal scrolling', keyboardFocus: 'PASS', reducedMotion: 'PASS', errors: 0, screenshotDir }, null, 2));
  } finally {
    ws.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
