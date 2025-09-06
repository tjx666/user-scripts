// ==UserScript==
// @name         GitHub Actions Copy Logs
// @namespace    https://github.com/yutengjing/user-scripts
// @version      0.4.0
// @description  Copy GitHub Actions step logs: hover header to show icon; click expands step, progressively scrolls to render all lines, then copies. Includes debug logs.
// @author       JingGe helper
// @match        https://github.com/*/*/actions/runs/*/job/*
// @match        https://github.com/*/*/commit/*/checks/*
// @grant        GM_setClipboard
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
  GitHub UI notes:
  - Each step root: <check-step ... data-conclusion="..." ...>
  - Step header:    summary.CheckStep-header
  - Logs container: .js-checks-log-display-container
  - Log line text:  .js-check-step-line .js-check-line-content

  Behavior:
  - Inject a small Copy button inside step header; only visible on header :hover/:focus-within
  - Works for all steps (success/failure)
  - On click: prevent summary toggle; expand → stabilize by repeated scrollIntoView → collect log lines → copy
*/

(function () {
    'use strict';

    // ===== Debug utilities (set DEBUG = true to enable console logs) =====
    const DEBUG = false; // set true to enable console logs
    const LOG_PREFIX = '[GH Actions Copy]';
    function log(...args) {
        if (DEBUG) console.log(LOG_PREFIX, ...args);
    }

    // Tunables
    const CONFIG = {
        STABLE_THRESHOLD: 10, // times of no new lines before stopping
        LOOP_DELAY_MS: 90, // delay between scroll attempts
        MAX_LOOPS: 400, // hard stop guard
    };

    const SELECTORS = {
        // Apply to all steps (success, failure, etc.)
        stepRoot: 'check-step',
        headerSummary: 'summary.CheckStep-header',
        headerRow: '.d-flex.flex-items-center',
        details: 'details.Details-element.CheckStep',
        logsContainer: '.js-checks-log-display-container',
        logLines: '.js-check-step-line .js-check-line-content',
        truncatedNotice: '.js-checks-log-display-truncated',
    };

    init();

    function init() {
        injectStyle();
        scanAndEnhance();
        observeMutations();
        hookGhNav();
    }

    function injectStyle() {
        if (document.head.querySelector('style[data-ghac]')) return; // avoid duplicate styles on Turbo
        const css = `
      /* Inline small icon placed before time; only visible on hover */
      .ghac-copy-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;margin-right:8px;border-radius:6px;border:1px solid transparent;color:var(--fgColor-muted,#57606a);background:transparent;cursor:pointer;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease}
      .ghac-copy-btn:hover{background:var(--control-transparent-bgColor-hover,rgba(175,184,193,0.2))}
      summary.CheckStep-header:hover .ghac-copy-btn,summary.CheckStep-header:focus-within .ghac-copy-btn{opacity:1;visibility:visible;pointer-events:auto}
      .ghac-copy-btn svg{width:16px;height:16px;fill:currentColor}
      .ghac-toast{position:fixed;z-index:9999;left:50%;bottom:24px;transform:translateX(-50%);background:var(--overlay-bgColor,rgba(27,31,36,0.9));color:#fff;padding:8px 12px;border-radius:6px;font-size:12px;box-shadow:0 8px 24px rgba(140,149,159,0.2)}
    `;
        const style = document.createElement('style');
        style.setAttribute('data-ghac', '');
        style.textContent = css;
        document.head.appendChild(style);
    }

    const busySteps = new WeakSet();

    function scanAndEnhance(root = document) {
        const steps = root.querySelectorAll(SELECTORS.stepRoot);
        steps.forEach(ensureButton);
    }

    function observeMutations() {
        const mo = new MutationObserver((muts) => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (node.matches && node.matches(SELECTORS.stepRoot)) {
                        ensureButton(node);
                    }
                    node.querySelectorAll?.(SELECTORS.stepRoot).forEach(ensureButton);
                }
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    function hookGhNav() {
        // GitHub uses Turbo/partial reloads
        const rerun = () => setTimeout(scanAndEnhance, 50);
        window.addEventListener('turbo:load', rerun);
        window.addEventListener('turbo:render', rerun);
        document.addEventListener('pjax:end', rerun);
        window.addEventListener('popstate', rerun);
    }

    function ensureButton(stepEl) {
        if (!(stepEl instanceof HTMLElement)) return;
        const header = stepEl.querySelector(SELECTORS.headerSummary);
        if (!header) return;
        if (header.querySelector('.ghac-copy-btn')) return;

        const row = header.querySelector(SELECTORS.headerRow) || header;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ghac-copy-btn';
        btn.title = 'Copy this step logs';
        btn.setAttribute('aria-label', 'Copy this step logs');
        btn.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 2.75A1.75 1.75 0 0 1 3.75 1h6.5C11.216 1 12 1.784 12 2.75V4H6.75A1.75 1.75 0 0 0 5 5.75v6.25H3.75A1.75 1.75 0 0 1 2 10.25v-7.5ZM6.75 5.5h6.5c.966 0 1.75.784 1.75 1.75v6c0 .966-.784 1.75-1.75 1.75h-6.5A1.75 1.75 0 0 1 5 13.25v-6c0-.966.784-1.75 1.75-1.75Z"></path>
      </svg>
    `;

        btn.addEventListener(
            'click',
            async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (busySteps.has(stepEl)) {
                    log('Skip click: step is busy');
                    return;
                }
                busySteps.add(stepEl);
                const ok = await copyStepLogs(stepEl).catch(() => false);
                busySteps.delete(stepEl);
                toast(ok ? 'Copied step logs ✅' : 'Copy failed ❌');
            },
            { capture: true },
        );
        // Insert before the time element to avoid impacting title width
        const timeEl = row.querySelector('.text-mono.text-normal.text-small.float-right');
        if (timeEl) {
            timeEl.parentNode.insertBefore(btn, timeEl);
        } else {
            row.appendChild(btn);
        }
        const name = stepEl.getAttribute('data-name') || '(unknown)';
        const num = stepEl.getAttribute('data-number') || '?';
        log('Injected copy button into step', { num, name });
    }

    async function copyStepLogs(stepEl) {
        // Expand first to ensure logs are loaded
        await expandStepAndWait(stepEl);

        // Ensure virtualized content fully renders by repeated scrollIntoView monitoring
        await loadAllLinesByRepeatedScroll(stepEl);

        // Gather all lines after stabilization
        const text = collectAllCurrentlyRenderedLines(stepEl);
        if (!text) return false;

        try {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text, 'text');
                return true;
            }
        } catch {}

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch {}

        // Fallback to execCommand
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    }

    // (removed) Legacy progressive scroll collector

    function collectAllCurrentlyRenderedLines(stepEl) {
        const map = new Map();
        stepEl.querySelectorAll('.js-check-step-line').forEach((line) => {
            const numEl = line.querySelector('.CheckStep-line-number');
            const contentEl = line.querySelector('.js-check-line-content');
            const num = parseInt((numEl?.textContent || '').trim(), 10);
            const txt = (contentEl?.innerText || '').trim();
            if (!Number.isNaN(num) && txt && !map.has(num)) map.set(num, txt);
        });
        const nums = Array.from(map.keys()).sort((a, b) => a - b);
        return nums.map((n) => map.get(n)).join('\n');
    }

    async function loadAllLinesByRepeatedScroll(stepEl) {
        const container = stepEl.querySelector(SELECTORS.logsContainer);
        if (!container) return;

        const initialNext = getNextStep(stepEl);

        let stable = 0;
        let lastCount = 0;
        let lastMax = 0;
        let loops = 0;
        let mutated = false;

        const mo = new MutationObserver((muts) => {
            for (const m of muts) {
                if (m.addedNodes && m.addedNodes.length) {
                    mutated = true;
                }
            }
        });
        mo.observe(container, { childList: true, subtree: true });

        const readMetrics = () => {
            const lines = stepEl.querySelectorAll('.js-check-step-line');
            const count = lines.length;
            let max = 0;
            if (count) {
                const last = lines[lines.length - 1];
                const n = parseInt(
                    (last.querySelector('.CheckStep-line-number')?.textContent || '').trim(),
                    10,
                );
                if (!Number.isNaN(n)) max = n;
            }
            return { count, max };
        };

        const curNum = stepEl.getAttribute('data-number') || '?';
        const nextNum = initialNext?.getAttribute?.('data-number') || null;
        log('Stabilize scroll start', {
            curStep: curNum,
            nextStep: nextNum,
            hasNext: !!initialNext,
        });
        while (loops < CONFIG.MAX_LOOPS) {
            loops++;
            // Jump scroll: bring next step (or end) into view fast
            const nextStep = getNextStep(stepEl);
            if (nextStep && nextStep.scrollIntoView) {
                // Scroll the immediate next <check-step> into view to trigger virtualization
                nextStep.scrollIntoView({ block: 'start', behavior: 'auto' });
            } else {
                // No next step: bring current step end / last line into view
                const lastLine = stepEl.querySelector('.js-check-step-line:last-child');
                if (lastLine && lastLine.scrollIntoView) {
                    lastLine.scrollIntoView({ block: 'end', behavior: 'auto' });
                } else {
                    stepEl.scrollIntoView({ block: 'end', behavior: 'auto' });
                }
            }

            await delay(CONFIG.LOOP_DELAY_MS);

            const { count, max } = readMetrics();
            const nextNow = getNextStep(stepEl);
            const nextNowNum = nextNow?.getAttribute?.('data-number') || null;
            const progressed = count > lastCount || max > lastMax || mutated;
            log('Stabilize loop', {
                loops,
                count,
                max,
                progressed,
                mutated,
                hasNext: !!nextNow,
                nextStepNum: nextNowNum,
            });
            mutated = false;

            if (progressed) {
                stable = 0;
                lastCount = count;
                lastMax = max;
            } else {
                stable++;
            }

            if (stable >= CONFIG.STABLE_THRESHOLD) {
                log('Stabilize done', { loops, finalCount: lastCount, finalMax: lastMax });
                break;
            }
        }

        mo.disconnect();
    }

    // (helpers removed: getScrollRoot/getScrollTop/scrollToY/yOfElementInScroll)

    function getNextStep(stepEl) {
        if (!(stepEl instanceof Element)) return null;
        // Prefer the official logs scroll container
        const container = stepEl.closest('.WorkflowRunLogsScroll') || stepEl.parentElement;
        if (container) {
            // Build an ordered list of sibling check-steps within the container
            const steps = Array.from(container.querySelectorAll('check-step'));
            const idx = steps.indexOf(stepEl);
            if (idx >= 0 && idx + 1 < steps.length) return steps[idx + 1];
        }
        // Fallback: walk nextElementSibling chain
        let n = stepEl.nextElementSibling;
        while (n) {
            if (n.matches && n.matches('check-step')) return n;
            n = n.nextElementSibling;
        }
        return null;
    }

    async function expandStepAndWait(stepEl) {
        const details = stepEl.querySelector(SELECTORS.details);
        if (!details) return null;

        if (!details.open) {
            const summary = details.querySelector(SELECTORS.headerSummary);
            if (summary) {
                // Trigger GitHub's lazy loader by simulating a click on summary
                log('Expanding step via summary click');
                summary.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            } else {
                log('Expanding step by setting details.open');
                details.open = true; // fallback
            }
        }

        // Wait for logs container to be present and not hidden
        const container = await waitFor(
            () => {
                const c = stepEl.querySelector(SELECTORS.logsContainer);
                if (!c) return null;
                if (c.hasAttribute('hidden')) return null;
                return c;
            },
            5000,
            100,
        );
        log('Logs container ready?', { ready: !!container });

        // Then wait for at least one line (best effort)
        const firstLine = await waitFor(() => stepEl.querySelector(SELECTORS.logLines), 2000, 100);
        log('First log line present?', { present: !!firstLine });
        return container;
    }

    function delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    function waitFor(condFn, timeoutMs = 1000, interval = 50) {
        return new Promise((resolve) => {
            const start = Date.now();
            const id = setInterval(() => {
                const el = condFn();
                if (el || Date.now() - start > timeoutMs) {
                    clearInterval(id);
                    resolve(el);
                }
            }, interval);
        });
    }

    function toast(message, ms = 1600) {
        const t = document.createElement('div');
        t.className = 'ghac-toast';
        t.textContent = message;
        document.body.appendChild(t);
        setTimeout(() => {
            t.remove();
        }, ms);
    }
})();
