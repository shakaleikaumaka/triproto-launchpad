/**
 * OhanaWorld — "verified human operator" mark for My Agent ʻOhana launchpad listings.
 *
 * World ID Selfie Check (Beta) via @worldcoin/idkit-core 4.2.4, sandbox-first.
 * Spec: whitepaper §L4 — "World Selfie Check marks listings operated by a verified
 * human (World ID = the trust layer, never a blessing-gate)".
 *
 * Lane F wiring (3 lines):
 *   <script src="/integrations/world/verify.js"></script>
 *   const v = OhanaWorld.createOperatorVerifier({ signal: listing.operatorAddress });
 *   v.mount(document.querySelector('#world-verify-btn'), document.querySelector('#world-badge'));
 *
 * The verifier talks to the tiny backend in server.mjs (RP signing + proof verify +
 * nullifier replay guard). Client NEVER sees the signing key.
 *
 * States: idle → loading-sdk → requesting-rp-context → presenting → waiting_for_connection
 *         → awaiting_confirmation → verifying → verified | failed | cancelled
 */
(function () {
  'use strict';

  var DEFAULTS = {
    action: 'ohana-operator-verify',
    environment: 'sandbox', // 'sandbox' | 'staging' | 'production'
    serverUrl: '', // base URL of server.mjs, e.g. http://localhost:8420
    sdkBase: null, // folder containing idkit.global.js + idkit_wasm_bg.wasm (default: alongside this file)
    inviteCode: false, // true → invite-code mode (friendlier for iOS cold installs)
    requireUserPresence: false, // true → extra liveness gate in World ID app
    pollInterval: 1500,
    timeout: 15 * 60 * 1000, // matches IDKit default (15 min)
    autoOpen: true, // auto-start on mount even without a button
    debug: false
  };

  // Error codes that mean "the human already proved themselves" — treat as soft-success upstream.
  var TERMINAL_OK = ['nullifier_replayed', 'max_verifications_reached'];
  // User-cancel codes — UI should offer a clean retry, not an error banner.
  var USER_CANCEL = ['user_rejected', 'verification_rejected', 'cancelled'];

  function log(cfg) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (cfg.debug) console.log('[OhanaWorld]', args.join(' '));
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  // Resolve the vendor folder relative to THIS script (works from any page depth).
  function defaultSdkBase() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      var idx = src.indexOf('/integrations/world/verify.js');
      if (idx !== -1) return src.slice(0, idx) + '/integrations/world/vendor/';
    }
    return './vendor/'; // fallback: page is expected to sit next to integrations/
  }

  function ensureSdk(cfg) {
    if (window.IDKit) return Promise.resolve(window.IDKit);
    var base = cfg.sdkBase || defaultSdkBase();
    log(cfg, 'loading IDKit from', base);
    return loadScript(base + 'idkit.global.js').then(function () {
      if (!window.IDKit) throw new Error('IDKit global missing after load');
      return window.IDKit;
    });
  }

  function renderQR(el, text) {
    if (!el) return;
    el.innerHTML = '';
    if (typeof window.qrcode === 'undefined') {
      // QR lib optional — fall back to a plain link.
      var a = document.createElement('a');
      a.href = text;
      a.textContent = 'Open in World ID app';
      a.target = '_blank';
      el.appendChild(a);
      return;
    }
    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    el.innerHTML = qr.createImgTag(4, 8);
    var img = el.querySelector('img');
    if (img) { img.style.width = '232px'; img.style.height = '232px'; img.style.imageRendering = 'pixelated'; }
  }

  function setBadge(badgeEl, state, detail) {
    if (!badgeEl) return;
    var map = {
      idle: ['⚪', 'Not verified'],
      working: ['🟡', 'Verifying…'],
      verified: ['🟢', 'Verified human operator'],
      cancelled: ['⚪', 'Verification cancelled'],
      failed: ['🔴', 'Verification failed']
    };
    var m = map[state] || map.idle;
    badgeEl.textContent = m[0] + ' ' + (detail || m[1]);
    badgeEl.setAttribute('data-world-state', state);
  }

  function createOperatorVerifier(userCfg) {
    var cfg = Object.assign({}, DEFAULTS, userCfg || {});
    if (!cfg.serverUrl) console.warn('[OhanaWorld] serverUrl is empty — set it to your server.mjs base URL.');
    var state = 'idle';
    var badgeEl = null;
    var qrEl = null;
    var currentRequest = null;
    var abort = null;

    function emit(patch) {
      if (state === 'verified' && !(patch && patch.force)) return; // sticky success
      if (patch && patch.state) state = patch.state;
      var uiState = state === 'verified' ? 'verified'
        : state === 'failed' ? 'failed'
        : state === 'cancelled' ? 'cancelled'
        : state === 'idle' ? 'idle' : 'working';
      setBadge(badgeEl, uiState, patch && patch.label);
      if (cfg.onState) cfg.onState(state, patch || {});
    }

    function fail(err, code) {
      state = 'failed';
      var payload = { state: 'failed', label: 'Verification failed', error: String(err && err.message || err), code: code || (err && err.code) || 'generic_error', force: true };
      emit(payload);
      if (cfg.onError) cfg.onError(payload);
    }

    function fetchRpContext() {
      return fetch(cfg.serverUrl + '/api/world/rp-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: cfg.action })
      }).then(function (r) {
        if (!r.ok) throw new Error('rp-context HTTP ' + r.status);
        return r.json();
      });
    }

    function verifyBackend(result) {
      return fetch(cfg.serverUrl + '/api/world/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: result, action: cfg.action, signal: cfg.signal || null })
      }).then(function (r) { return r.json().then(function (body) { body._http = r.status; return body; }); });
    }

    function start() {
      if (state !== 'idle' && state !== 'failed' && state !== 'cancelled') return;
      abort = new AbortController();
      emit({ state: 'loading-sdk', label: 'Loading World ID…', force: true });
      ensureSdk(cfg)
        .then(function (IDKit) {
          emit({ state: 'requesting-rp-context', label: 'Preparing request…' });
          return fetchRpContext().then(function (rp) {
            // rp = { rp_id, sig, nonce, created_at, expires_at } — signed server-side.
            var reqCfg = {
              app_id: cfg.app_id,
              action: cfg.action,
              rp_context: {
                rp_id: rp.rp_id,
                nonce: rp.nonce,
                created_at: rp.created_at,
                expires_at: rp.expires_at,
                signature: rp.sig
              },
              // Selfie Check returns World ID 3.0 proofs today — legacy MUST be allowed.
              allow_legacy_proofs: true,
              require_user_presence: !!cfg.requireUserPresence,
              environment: cfg.environment
            };
            log(cfg, 'request config', JSON.stringify({ environment: cfg.environment, action: cfg.action }));
            var builder = cfg.inviteCode ? IDKit.requestWithInviteCode(reqCfg) : IDKit.request(reqCfg);
            return builder.preset(IDKit.selfieCheckLegacy({ signal: cfg.signal || undefined }));
          });
        })
        .then(function (request) {
          currentRequest = request;
          emit({ state: 'presenting', label: 'Scan with World ID (sandbox) app', force: true });
          renderQR(qrEl, request.connectorURI);
          if (cfg.onConnector) cfg.onConnector(request.connectorURI, request);
          return request.pollUntilCompletion({
            pollInterval: cfg.pollInterval,
            timeout: cfg.timeout,
            signal: abort.signal
          });
        })
        .then(function (completion) {
          if (!completion) return; // aborted
          if (!completion.success) {
            var code = completion.error || 'generic_error';
            if (USER_CANCEL.indexOf(code) !== -1) {
              state = 'cancelled';
              emit({ state: 'cancelled', label: 'Verification cancelled', code: code, force: true });
              return;
            }
            if (TERMINAL_OK.indexOf(code) !== -1) {
              // Already proved for this action — surface as verified with a note.
              state = 'verified';
              emit({ state: 'verified', label: 'Verified human operator (already on file)', code: code, force: true });
              if (cfg.onVerified) cfg.onVerified({ already: true, code: code });
              return;
            }
            fail(new Error('World ID error: ' + code), code);
            return;
          }
          emit({ state: 'verifying', label: 'Confirming proof…', force: true });
          return verifyBackend(completion.result).then(function (vr) {
            if (vr && vr.ok) {
              state = 'verified';
              var badge = {
                nullifier: vr.nullifier,
                credential: vr.credential || 'selfie',
                protocol_version: vr.protocol_version,
                environment: vr.environment || cfg.environment,
                verified_at: new Date().toISOString()
              };
              emit({ state: 'verified', label: 'Verified human operator', force: true });
              if (cfg.onVerified) cfg.onVerified(badge);
            } else {
              fail(new Error((vr && vr.error) || 'backend verification failed'), (vr && vr.code) || 'backend');
            }
          });
        })
        .catch(function (err) {
          if (err && (err.name === 'AbortError' || /abort/i.test(String(err.message)))) return;
          fail(err);
        });
    }

    function mount(btnEl, badge, qr) {
      badgeEl = badge || badgeEl;
      qrEl = qr || qrEl;
      setBadge(badgeEl, 'idle');
      if (btnEl) {
        btnEl.addEventListener('click', function () { start(); });
      } else if (cfg.autoOpen) {
        start();
      }
      return api;
    }

    function cancel() {
      if (abort) abort.abort();
      state = 'cancelled';
      emit({ state: 'cancelled', label: 'Verification cancelled', force: true });
    }

    var api = {
      mount: mount,
      start: start,
      cancel: cancel,
      state: function () { return state; },
      debugReport: function () { return currentRequest ? currentRequest.getDebugReport() : null; }
    };
    return api;
  }

  window.OhanaWorld = {
    createOperatorVerifier: createOperatorVerifier,
    version: '1.0.0',
    sdk: '@worldcoin/idkit-core@4.2.4'
  };
})();
