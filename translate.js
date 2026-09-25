/* Spanish toggle for dkelectricllc.com
 *
 * Replaces the Google Translate widget, which put a grey Google bar across the
 * top of every page, set a cookie, loaded a render-blocking third-party script,
 * and could only be undone through that same bar.
 *
 * How this works: es.json maps the exact English string to its Spanish. On
 * toggle we walk the text nodes once and swap them. The original English is
 * kept on the node, so switching back is exact rather than a second
 * translation. Nothing leaves the browser, no cookie is set, and the choice is
 * remembered in localStorage.
 *
 * The dictionary is fetched only when someone asks for Spanish, so English
 * visitors — the majority — pay nothing for this.
 *
 * If a string is missing from es.json it stays in English rather than breaking.
 * That is deliberate: a half-translated sentence is worse than an English one.
 */
(function () {
  'use strict';

  var KEY = 'dk-lang';
  var dict = null;
  var originals = new WeakMap();
  var current = 'en';

  // Text inside these never gets touched.
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, svg: 1, SVG: 1 };

  function textNodes(root) {
    var out = [];
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        for (var p = n.parentNode; p && p !== root; p = p.parentNode) {
          if (SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
          if (p.hasAttribute && p.hasAttribute('data-no-translate')) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walk.nextNode())) out.push(n);
    return out;
  }

  // Swap a node's text, preserving the leading/trailing whitespace the layout
  // depends on. Without this, inline elements lose the spaces around them.
  function swap(node, to) {
    var raw = node.nodeValue;
    var key = raw.trim().replace(/\s+/g, ' ');
    if (!key) return;
    if (to === 'es') {
      var es = dict[key];
      if (!es) return;
      originals.set(node, raw);
      node.nodeValue = raw.replace(raw.trim(), es);
    } else {
      var en = originals.get(node);
      if (en !== undefined) { node.nodeValue = en; originals.delete(node); }
    }
  }

  // Attributes that are read aloud or shown on hover need translating too.
  var ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
  function swapAttrs(to) {
    ATTRS.forEach(function (a) {
      Array.prototype.forEach.call(document.querySelectorAll('[' + a + ']'), function (el) {
        var store = 'data-en-' + a;
        if (to === 'es') {
          var v = el.getAttribute(a).trim().replace(/\s+/g, ' ');
          var es = dict[v];
          if (!es) return;
          el.setAttribute(store, el.getAttribute(a));
          el.setAttribute(a, es);
        } else if (el.hasAttribute(store)) {
          el.setAttribute(a, el.getAttribute(store));
          el.removeAttribute(store);
        }
      });
    });
  }

  function apply(to) {
    if (to === 'es' && !dict) return;
    textNodes(document.body).forEach(function (n) { swap(n, to); });
    swapAttrs(to);
    document.documentElement.lang = to;
    if (dict) {
      var t = document.title.trim();
      if (to === 'es' && dict[t]) { document.documentElement.setAttribute('data-en-title', document.title); document.title = dict[t]; }
      else if (to === 'en' && document.documentElement.hasAttribute('data-en-title')) {
        document.title = document.documentElement.getAttribute('data-en-title');
        document.documentElement.removeAttribute('data-en-title');
      }
    }
    current = to;
    var btn = document.getElementById('lang-btn');
    if (btn) {
      btn.textContent = to === 'es' ? 'English' : 'Español';
      btn.setAttribute('aria-label', to === 'es' ? 'Switch to English' : 'Cambiar a español');
      btn.setAttribute('lang', to === 'es' ? 'en' : 'es');
    }
  }

  function load() {
    if (dict) return Promise.resolve();
    return fetch('/es.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { dict = j; });
  }

  function toggle() {
    var to = current === 'es' ? 'en' : 'es';
    if (to === 'en') { apply('en'); try { localStorage.setItem(KEY, 'en'); } catch (e) {} return; }
    load().then(function () {
      apply('es');
      try { localStorage.setItem(KEY, 'es'); } catch (e) {}
    }).catch(function () {
      // Dictionary unreachable. Say so rather than silently doing nothing.
      var btn = document.getElementById('lang-btn');
      if (btn) btn.textContent = 'Español';
    });
  }

  function init() {
    var btn = document.getElementById('lang-btn');
    if (btn) btn.addEventListener('click', toggle);
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved === 'es') load().then(function () { apply('es'); }).catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
