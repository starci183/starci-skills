// Native browser failures, explicit injected faults and lifecycle cancellations retain distinct evidence.
const monitors = new WeakMap();

/** Close the actual browser after marking attached contexts for cleanup, then flush retained native fault evidence. */
export async function closeTelemetryBrowser(browser, report) {
  const attached = monitors.get(report) ?? [];
  for (const telemetry of attached) telemetry.beginCleanup();
  try { await browser.close(); }
  finally { for (const telemetry of attached) telemetry.flush(); }
}

/** Observe the actual page through Playwright/CDP and retain exact injected-fault or lifecycle attribution; unknown failures stay blocking. */
export async function attachBrowserTelemetry(page, report, initialCase) {
  for (const field of ['consoleErrors', 'networkErrors', 'expectedFaults', 'lifecycleCancellations']) report[field] ??= [];
  let attribution = { ...initialCase };
  let generation = 0;
  let sequence = 0;
  let closing = false;
  const location = () => ({ ...attribution, route: page.url(), generation, at: new Date().toISOString() });
  const requests = new Map();
  const pending = new Set();
  const failures = [];
  const consoles = [];
  const observedFaults = [];
  const expectedUrls = new Map();
  const pageErrors = [];
  const browserIntents = new Map();
  const networkStarts = [];
  const networkFailures = new Map();
  const networkResponses = new Map();
  const responseExtraInfo = new Map();
  const responseEvents = [];
  const nativeFailureCounts = new Map();
  const frameDocuments = new Map();
  const executionFrames = new Map();
  const rawFailures = [];
  const recordedGroups = new Set();
  const recordedNativeFailures = new Set();
  report.rawPlaywrightRequestFailures ??= [];
  report.rawNativeRequestFailures ??= [];
  report.rawBrowserIntents ??= [];
  report.rawNativeResponses ??= [];
  const session = await page.context().newCDPSession(page);
  session.on('Page.frameNavigated', event => frameDocuments.set(event.frame.id, { loaderId: event.frame.loaderId, documentUrl: event.frame.url }));
  session.on('Runtime.executionContextCreated', event => executionFrames.set(event.context.id, {
    frameId: event.context.auxData?.frameId, ...frameDocuments.get(event.context.auxData?.frameId),
  }));
  session.on('Runtime.bindingCalled', event => {
    if (event.name !== '__starciProofIntent') return;
    try {
      const item = JSON.parse(event.payload);
      const document = executionFrames.get(event.executionContextId) ?? {};
      report.rawBrowserIntents.push({ ...location(), ...item, executionContextId: event.executionContextId, frameId: document.frameId, loaderId: document.loaderId });
      if (item.kind === 'observer-error') report.consoleErrors.push({ ...location(), ...item, kind: 'instrumentation-error',
        executionContextId: event.executionContextId, frameId: document.frameId, loaderId: document.loaderId });
      if (item.kind === 'start') {
        if (browserIntents.has(item.source)) browserIntents.get(item.source).duplicate = true;
        else browserIntents.set(item.source, { ...item, executionContextId: event.executionContextId, frameId: document.frameId, loaderId: document.loaderId });
      }
      else {
        const start = browserIntents.get(item.source);
        if (start) (start.events ??= []).push(item);
      }
    } catch (error) {
      report.consoleErrors.push({ ...location(), kind: 'instrumentation-error', message: String(error) });
    }
  });
  const stackSources = stack => stack ? [...(stack.callFrames ?? []).map(frame => frame.url), ...stackSources(stack.parent)] : [];
  session.on('Network.requestWillBeSent', event => networkStarts.push({
    ...location(), frameId: event.frameId, loaderId: event.loaderId,
    cdpRequestId: event.requestId, url: event.request.url, method: event.request.method,
    resourceType: event.type?.toLowerCase(), at: event.wallTime * 1000, timestamp: event.timestamp,
    sources: [...new Set(stackSources(event.initiator?.stack).filter(url => url.startsWith('starci-proof-intent://')))],
    redirected: Boolean(event.redirectResponse),
  }));
  session.on('Network.loadingFailed', event => {
    nativeFailureCounts.set(event.requestId, (nativeFailureCounts.get(event.requestId) ?? 0) + 1);
    networkFailures.set(event.requestId, event);
    report.rawNativeRequestFailures.push({ ...location(), kind: 'requestfailed', cdpRequestId: event.requestId,
      error: event.errorText, canceled: event.canceled, timestamp: event.timestamp });
  });
  session.on('Network.responseReceived', event => {
    const item = { ...location(), kind: 'response-received', cdpRequestId: event.requestId, timestamp: event.timestamp,
      resourceType: event.type?.toLowerCase(), url: event.response.url, status: event.response.status,
      statusText: event.response.statusText, mimeType: event.response.mimeType,
      fromDiskCache: event.response.fromDiskCache === true, fromServiceWorker: event.response.fromServiceWorker === true };
    networkResponses.set(event.requestId, item);
    responseEvents.push(item);
    report.rawNativeResponses.push(item);
  });
  session.on('Network.responseReceivedExtraInfo', event => {
    const item = { ...location(), kind: 'response-extra-info', cdpRequestId: event.requestId, status: event.statusCode };
    responseExtraInfo.set(event.requestId, item);
    responseEvents.push(item);
    report.rawNativeResponses.push(item);
  });
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Debugger.enable');
  await session.send('Network.enable');
  await session.send('Runtime.addBinding', { name: '__starciProofIntent' });
  await page.addInitScript(() => {
    let sequence = 0;
    const documentKey = String(performance.timeOrigin);
    const epoch = () => performance.timeOrigin + performance.now();
    const emit = value => window.__starciProofIntent(JSON.stringify({ ...value, at: epoch(), documentUrl: location.href }));
    const source = kind => `starci-proof-intent://${documentKey}/${kind}/${++sequence}.js`;
    const nativeFetch = window.fetch;
    window.fetch = function (...args) {
      const [input, init] = args;
      const url = new URL(input instanceof Request ? input.url : String(input), document.baseURI).href;
      const method = String(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const signal = init?.signal === undefined ? (input instanceof Request ? input.signal : null) : init.signal;
      const token = source('fetch');
      emit({ kind: 'start', source: token, transport: 'fetch', url, method, preAborted: Boolean(signal?.aborted), stack: new Error().stack });
      if (signal) signal.addEventListener('abort', () => emit({ kind: 'abort', source: token, stack: new Error().stack }), { once: true });
      // A unique call-frame URL exposes the native request's initiator in CDP.
      // The original URL, options and native Promise are passed through unchanged.
      const call = new Function('native', 'receiver', 'args', `return Reflect.apply(native, receiver, args);\n//# sourceURL=${token}`);
      const promise = call(nativeFetch, this, args);
      promise.then(response => {
        emit({ kind: 'fulfilled', source: token, status: response.status, responseUrl: response.url,
          responseType: response.type, bodyUsed: response.bodyUsed, bodyAbsent: response.body === null });
      }, error => {
        emit({ kind: 'rejected', source: token, errorName: error?.name, errorMessage: error?.message });
      }).catch(error => emit({ kind: 'observer-error', source: token, errorName: error?.name, errorMessage: error?.message }));
      return promise;
    };
    const NativeEventSource = window.EventSource;
    const instances = new WeakMap();
    const nativeClose = NativeEventSource.prototype.close;
    NativeEventSource.prototype.close = function (...args) {
      const instance = instances.get(this);
      if (instance) emit({ kind: 'close', source: instance.source, errorSeen: instance.errorSeen, stack: new Error().stack });
      return Reflect.apply(nativeClose, this, args);
    };
    window.EventSource = new Proxy(NativeEventSource, {
      construct(native, args, target) {
        const token = source('eventsource');
        const url = new URL(String(args[0]), document.baseURI).href;
        emit({ kind: 'start', source: token, transport: 'eventsource', url, method: 'GET', stack: new Error().stack });
        const call = new Function('native', 'args', 'target', `return Reflect.construct(native, args, target);\n//# sourceURL=${token}`);
        const instance = call(native, args, target);
        const state = { source: token, errorSeen: false };
        instances.set(instance, state);
        instance.addEventListener('error', () => { state.errorSeen = true; emit({ kind: 'error', source: token }); });
        return instance;
      },
    });
  });
  const requestMeta = request => {
    if (!requests.has(request)) requests.set(request, { ...location(), requestId: ++sequence,
      url: request.url(), method: request.method(), resourceType: request.resourceType() });
    return requests.get(request);
  };
  const pushFault = (item, expected) => {
    const recorded = { ...item, ...(expected ? { reason: expected.reason, expected: true } : {}) };
    (expected ? report.expectedFaults : report.networkErrors).push(recorded);
    observedFaults.push(recorded);
  };
  const markPending = (stage, reason, target) => {
    for (const request of pending) requestMeta(request).cancellation ??= { stage, reason, target, fromGeneration: generation };
  };
  page.on('request', request => {
    requestMeta(request);
    pending.add(request);
  });
  page.on('requestfinished', request => pending.delete(request));
  page.on('requestfailed', request => {
    const failure = { request, error: request.failure()?.errorText ?? 'Unknown request failure' };
    failures.push(failure);
    rawFailures.push(failure);
    report.rawPlaywrightRequestFailures.push({ ...requestMeta(request), kind: 'requestfailed', error: failure.error });
    pending.delete(request);
  });
  page.on('response', response => {
    if (response.status() < 400) return;
    const request = response.request();
    const meta = requestMeta(request);
    const expected = meta.expectedHttp?.status === response.status() ? meta.expectedHttp
      : expectedUrls.get(`${meta.case}\n${response.url()}\n${response.status()}`);
    pushFault({ ...meta, kind: 'http-error', status: response.status(), statusText: response.statusText() }, expected);
  });
  page.on('console', message => {
    if (message.type() === 'error') consoles.push({ ...location(), kind: 'console-error', message: message.text(), location: message.location() });
  });
  page.on('pageerror', error => {
    const item = { ...location(), kind: 'pageerror', message: error.message, stack: error.stack };
    pageErrors.push(item);
    report.consoleErrors.push(item);
  });
  const failureKey = (record, error) => `${record.case}\n${record.generation}\n${record.method}\n${record.resourceType}\n${record.url}\n${error}`;
  const rawGroup = (start, error) => rawFailures.filter(failure => failure.error === error
    && failureKey(requestMeta(failure.request), error) === failureKey(start, error));
  const nativeGroup = (start, error) => networkStarts.filter(other => failureKey(other, error) === failureKey(start, error)
    && networkFailures.get(other.cdpRequestId)?.errorText === error);
  const intervalEnd = intent => intent.events?.find(event => event.kind === 'close' || event.kind === 'error')?.at ?? Infinity;
  const insideInstance = (start, intent) => start.resourceType === 'eventsource' && intent.transport === 'eventsource' && intent.method === start.method
    && intent.url === start.url && intent.frameId === start.frameId && intent.loaderId === start.loaderId
    && Boolean(intent.loaderId) && intent.documentUrl === start.route && start.at >= intent.at && start.at <= intervalEnd(intent);
  const nativeIntentCandidates = start => {
    if (!start) return [];
    if (start.sources.length === 1) return [browserIntents.get(start.sources[0])].filter(Boolean);
    if (start.sources.length !== 0 || start.resourceType !== 'eventsource') return [];
    return [...browserIntents.values()].filter(intent => insideInstance(start, intent));
  };
  const intentForNative = start => {
    const candidates = nativeIntentCandidates(start);
    if (candidates.length !== 1) return null;
    const intent = candidates[0];
    if (start.sources.length === 0 && networkStarts.filter(other => insideInstance(other, intent)).length !== 1) return null;
    return intent;
  };
  const observedNativeError = (record, error) => nativeGroup(record, error).some(start =>
    nativeIntentCandidates(start).some(intent => intent.events?.some(event => event.kind === 'error' || event.kind === 'observer-error' || event.errorSeen === true)));
  const nativeCancellation = start => {
    if (!start || start.redirected || nativeFailureCounts.get(start.cdpRequestId) !== 1
      || networkStarts.filter(other => other.cdpRequestId === start.cdpRequestId).length !== 1) return null;
    const intent = intentForNative(start);
    if (start.sources.length === 1 && networkStarts.filter(other => other.sources.includes(start.sources[0])).length !== 1) return null;
    const failed = networkFailures.get(start.cdpRequestId);
    if (!intent || intent.duplicate || intent.preAborted || intent.events?.some(event => event.kind === 'observer-error')
      || !intent.frameId || intent.frameId !== start.frameId || intent.loaderId !== start.loaderId
      || intent.url !== start.url || intent.method !== start.method || intent.transport !== start.resourceType
      || failed?.errorText !== 'net::ERR_ABORTED' || failed.canceled !== true) return null;
    const failedAt = start.at + (failed.timestamp - start.timestamp) * 1000;
    const cause = intent.events?.find(event => (event.kind === 'abort' || event.kind === 'close')
      && event.errorSeen !== true && event.at >= intent.at && event.at <= failedAt
      && !intent.events.some(other => other.kind === 'error' && other.at <= event.at));
    if (!cause) return null;
    return { ...start, kind: 'requestfailed', error: failed.errorText, lifecycle: true,
      stage: cause.kind === 'abort' ? 'ui-signal-abort' : 'ui-eventsource-close',
      reason: cause.kind === 'abort' ? 'Observed AbortSignal abort for this native fetch' : 'Observed EventSource.close before any error for this native stream',
        source: intent.source, documentUrl: intent.documentUrl, executionContextId: intent.executionContextId,
        association: start.sources.length === 1 ? 'unique-initiator-token' : 'unique-native-instance-interval',
      startAt: intent.at, causeAt: cause.at, failureAt: failedAt, callsite: cause.stack,
      identityOwner: 'CDP Network.requestId' };
  };
  const nativeReadCompletion = start => {
    if (!start || start.resourceType !== 'fetch' || start.method !== 'GET' || start.redirected || start.sources.length !== 1
      || nativeFailureCounts.get(start.cdpRequestId) !== 1
      || networkStarts.filter(other => other.cdpRequestId === start.cdpRequestId).length !== 1
      || networkStarts.filter(other => other.sources.includes(start.sources[0])).length !== 1) return null;
    const intent = browserIntents.get(start.sources[0]);
    const failed = networkFailures.get(start.cdpRequestId);
    if (!intent || intent.duplicate || intent.preAborted || intent.transport !== 'fetch' || intent.method !== 'GET'
      || intent.url !== start.url || !intent.frameId || intent.frameId !== start.frameId
      || !intent.loaderId || intent.loaderId !== start.loaderId || intent.documentUrl !== start.route
      || failed?.errorText !== 'net::ERR_ABORTED' || failed.canceled !== true
      || intent.events?.some(event => ['abort', 'rejected', 'error', 'observer-error'].includes(event.kind))) return null;
    const responses = responseEvents.filter(event => event.cdpRequestId === start.cdpRequestId && event.kind === 'response-received');
    const extras = responseEvents.filter(event => event.cdpRequestId === start.cdpRequestId && event.kind === 'response-extra-info');
    const fulfilled = intent.events?.filter(event => event.kind === 'fulfilled') ?? [];
    if (responses.length !== 1 || extras.length !== 1 || fulfilled.length !== 1) return null;
    const response = responses[0];
    const result = fulfilled[0];
    if (response.status !== 304 || extras[0].status !== 304 || response.url !== start.url || response.resourceType !== 'fetch'
      || response.timestamp < start.timestamp || response.timestamp >= failed.timestamp
      || result.status !== 304 || result.responseUrl !== start.url || result.at < intent.at) return null;
    return { ...start, kind: 'requestfailed', error: failed.errorText, canceled: true, lifecycle: true,
      stage: 'successful-304-stream-completion', reason: 'Native GET fulfilled 304; the matching 304 response preceded stream ERR_ABORTED',
      source: intent.source, documentUrl: intent.documentUrl, executionContextId: intent.executionContextId,
      association: 'unique-initiator-token', identityOwner: 'CDP Network.requestId',
      startAt: intent.at, responseReceivedAt: start.at + (response.timestamp - start.timestamp) * 1000,
      fulfilledAt: result.at, failureAt: start.at + (failed.timestamp - start.timestamp) * 1000,
      observedReadStatus: 304, response, responseExtraInfo: extras[0], promise: result };
  };
  const nativeLifecycleReceipt = start => nativeCancellation(start) ?? nativeReadCompletion(start);
  const observedCancellationGroup = request => {
    const meta = requestMeta(request);
    const groupKey = failureKey(meta, 'net::ERR_ABORTED');
    const raw = rawGroup(meta, 'net::ERR_ABORTED');
    const starts = nativeGroup(meta, 'net::ERR_ABORTED');
    if (!raw.length || raw.length !== starts.length) return null;
    const receipts = starts.map(nativeLifecycleReceipt);
    if (receipts.some(receipt => !receipt)) return null;
    for (const receipt of receipts) Object.assign(receipt, { rawCoverage: 'complete-group', rawCoverageGroup: groupKey,
      rawPlaywrightRequestIds: raw.map(failure => requestMeta(failure.request).requestId) });
    // Interception can reorder Playwright Request events. This is only complete group
    // coverage; no ordinal pairing or individual Playwright-to-CDP identity is claimed.
    return { groupKey, receipts };
  };
  const flush = () => {
    for (const { request, error } of failures.splice(0)) {
      const meta = requestMeta(request);
      if (meta.expectedAbort?.error === error) {
        pushFault({ ...meta, kind: 'requestfailed', error }, meta.expectedAbort);
      } else if (error === 'net::ERR_ABORTED' && meta.cancellation && !observedNativeError(meta, error)) {
        const item = { ...meta, kind: 'requestfailed', error, lifecycle: true, stage: meta.cancellation.stage, reason: meta.cancellation.reason };
        report.lifecycleCancellations.push(item);
        observedFaults.push(item);
      } else {
        const group = error === 'net::ERR_ABORTED' ? observedCancellationGroup(request) : null;
        if (group) {
          if (!recordedGroups.has(group.groupKey)) {
            recordedGroups.add(group.groupKey);
            report.lifecycleCancellations.push(...group.receipts);
            observedFaults.push(...group.receipts);
            for (const receipt of group.receipts) recordedNativeFailures.add(receipt.cdpRequestId);
          }
        } else pushFault({ ...meta, kind: 'requestfailed', error,
          ...(error === 'net::ERR_ABORTED' ? { cancellationEvidence: networkStarts
            .filter(start => start.url === meta.url && start.method === meta.method && start.resourceType === meta.resourceType
              && start.case === meta.case && start.generation === meta.generation)
            .map(start => ({ ...start, failed: networkFailures.get(start.cdpRequestId),
              response: networkResponses.get(start.cdpRequestId), responseExtraInfo: responseExtraInfo.get(start.cdpRequestId),
              intents: nativeIntentCandidates(start) })) } : {}) });
      }
    }
    for (const [cdpRequestId, failed] of networkFailures) {
      if (recordedNativeFailures.has(cdpRequestId)) continue;
      recordedNativeFailures.add(cdpRequestId);
      const matches = networkStarts.filter(start => start.cdpRequestId === cdpRequestId);
      const start = matches.length === 1 ? matches[0] : null;
      const nativeReceipt = nativeLifecycleReceipt(start);
      if (nativeReceipt) {
        const receipt = { ...nativeReceipt, rawCoverage: 'native-only', rawPlaywrightIdentityClaimed: false };
        report.lifecycleCancellations.push(receipt);
        observedFaults.push(receipt);
        continue;
      }
      const raw = start ? rawGroup(start, failed.errorText) : [];
      const sameGroup = start ? nativeGroup(start, failed.errorText) : [];
      const complete = raw.length > 0 && raw.length === sameGroup.length
        && sameGroup.every(member => networkStarts.filter(other => other.cdpRequestId === member.cdpRequestId).length === 1);
      const exactExpected = complete && raw.every(failure => requestMeta(failure.request).expectedAbort?.error === failed.errorText);
      const exactLifecycle = complete && failed.errorText === 'net::ERR_ABORTED' && failed.canceled === true
        && !observedNativeError(start, failed.errorText)
        && raw.every(failure => ['navigation', 'context-close'].includes(requestMeta(failure.request).cancellation?.stage));
      const item = { ...(start ?? location()), kind: 'requestfailed', cdpRequestId, error: failed.errorText,
        canceled: failed.canceled, identityOwner: 'CDP Network.requestId', rawCoverage: complete ? 'complete-group' : 'missing-or-ambiguous',
        rawPlaywrightIdentityClaimed: false, rawPlaywrightRequestIds: raw.map(failure => requestMeta(failure.request).requestId),
        response: networkResponses.get(cdpRequestId), responseExtraInfo: responseExtraInfo.get(cdpRequestId),
        cancellationEvidence: nativeIntentCandidates(start) };
      if (exactExpected) pushFault(item, requestMeta(raw[0].request).expectedAbort);
      else if (exactLifecycle) {
        const receipt = { ...item, lifecycle: true, stage: 'runner-lifecycle-group', reason: 'Every raw Request in this exact native failure group was pending at explicit runner navigation or close' };
        report.lifecycleCancellations.push(receipt); observedFaults.push(receipt);
      } else pushFault(item);
    }
    for (const item of consoles.splice(0)) {
      // Chromium's resource console is attributable only through an observed exact URL,
      // case and status/error. Arbitrary application console.error remains blocking.
      const status = item.message.match(/^Failed to load resource: the server responded with a status of (\d+)\b/);
      const network = item.message.match(/^Failed to load resource: (net::ERR_[A-Z_]+)$/);
      const fault = observedFaults.find(fault => fault.case === item.case && fault.url === item.location.url
        && ((status && fault.status === Number(status[1])) || (network && fault.error === network[1]))
        && (fault.expected || fault.lifecycle === true));
      if (fault) {
        const recorded = { ...item, requestId: fault.requestId, url: fault.url, status: fault.status,
          error: fault.error, reason: fault.reason, causedBy: fault.kind };
        (fault.expected ? report.expectedFaults : report.lifecycleCancellations).push(recorded);
      } else report.consoleErrors.push(item);
    }
  };
  const beginNavigation = (target, reason) => {
    markPending('navigation', reason, target);
    generation++;
  };
  const telemetry = {
    pageErrors,
    setCase(value) { attribution = { ...initialCase, ...value }; },
    async goto(url, options) { beginNavigation(url, 'Runner requested navigation'); return page.goto(url, options); },
    async reload(options) { beginNavigation(page.url(), 'Runner requested reload'); return page.reload(options); },
    async navigation(reason, action) { beginNavigation(page.url(), reason); return action(); },
    expectHttp(request, status, reason) { requestMeta(request).expectedHttp = { status, reason }; },
    expectHttpForUrl(url, status, reason) { expectedUrls.set(`${attribution.case}\n${url}\n${status}`, { status, reason }); },
    observeApiResponse(response) {
      if (response.status() >= 400) pushFault({ ...location(), kind: 'http-error', channel: 'api-request-context',
        url: response.url(), status: response.status(), statusText: response.statusText() },
      expectedUrls.get(`${attribution.case}\n${response.url()}\n${response.status()}`));
    },
    expectAbort(request, error, reason) { requestMeta(request).expectedAbort = { error, reason }; },
    beginCleanup() { closing = true; markPending('context-close', 'Runner is closing this context', page.url()); },
    routeActionError(request, error) {
      const meta = requestMeta(request);
      const message = error instanceof Error ? error.message : String(error);
      if (closing && meta.cancellation?.stage === 'context-close'
        && /^(?:route\.(?:abort|continue|fulfill|fetch): )?(?:Target page, context or browser has been closed|Target closed)(?:\n|$)/.test(message)) {
        report.lifecycleCancellations.push({ ...meta, kind: 'route-action', error: message, stage: 'context-close', reason: 'Exact intercepted request was already closing' });
      } else report.networkErrors.push({ ...meta, kind: 'route-action', error: message });
    },
    flush,
    async close(context) { this.beginCleanup(); try { await context.close(); } finally { flush(); } },
  };
  const attached = monitors.get(report) ?? [];
  attached.push(telemetry);
  monitors.set(report, attached);
  return telemetry;
}
