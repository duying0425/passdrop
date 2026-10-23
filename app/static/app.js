// PassDrop Client-side Logic

// --- i18n ---
// Dictionaries for every language are embedded by the server (#i18n-data), so switching
// language re-renders in place without a reload (reloading a ?f= link would burn a view).
const I18N = (() => {
  try {
    return JSON.parse(document.getElementById("i18n-data").textContent);
  } catch (err) {
    return { lang: "zh", fallback: "zh", cookie: "passdrop_lang", cookieMaxAge: 31536000, titleOverride: "", htmlLang: {}, messages: {} };
  }
})();
let currentLang = I18N.lang;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function hasMessage(key) {
  const table = I18N.messages[currentLang] || {};
  const fallback = I18N.messages[I18N.fallback] || {};
  return key in table || key in fallback;
}

// Looks up a message and fills {placeholders}; args are HTML-escaped when the result is used as HTML
function t(key, args = {}, html = false) {
  const table = I18N.messages[currentLang] || {};
  const fallback = I18N.messages[I18N.fallback] || {};
  const text = table[key] ?? fallback[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    if (!(name in args)) return match;
    const value = String(args[name]);
    return html ? escapeHtml(value) : value;
  });
}

function renderI18n(el) {
  let args = {};
  if (el.dataset.i18nArgs) {
    try {
      args = JSON.parse(el.dataset.i18nArgs);
    } catch (err) {
      args = {};
    }
  }
  if (el.hasAttribute("data-i18n-html")) {
    el.innerHTML = t(el.dataset.i18n, args, true);
  } else {
    el.textContent = t(el.dataset.i18n, args);
  }
}

// Binds an element to a message key so it is re-rendered when the language changes
function setI18n(el, key, args = null) {
  if (!el) return;
  el.dataset.i18n = key;
  if (args) {
    el.dataset.i18nArgs = JSON.stringify(args);
  } else {
    delete el.dataset.i18nArgs;
  }
  renderI18n(el);
}

// Sets literal text (numbers, server messages) and detaches the element from re-translation
function setPlainText(el, text) {
  if (!el) return;
  delete el.dataset.i18n;
  delete el.dataset.i18nArgs;
  el.textContent = text;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(renderI18n);
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  });
  document.documentElement.lang = I18N.htmlLang[currentLang] || currentLang;
  document.title = I18N.titleOverride || t("meta.title");
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute("content", t("meta.description"));
}

function setLanguage(lang) {
  if (!I18N.messages[lang] || lang === currentLang) return;
  currentLang = lang;
  try {
    document.cookie = `${I18N.cookie}=${lang}; path=/; max-age=${I18N.cookieMaxAge}; SameSite=Lax`;
  } catch (err) {
    // Cookies blocked: the choice still applies to this page
  }
  // An explicit ?lang= in the address bar outranks the cookie, so keep it in sync for refreshes
  const url = new URL(window.location.href);
  if (url.searchParams.has("lang")) {
    url.searchParams.set("lang", lang);
    history.replaceState(history.state, "", url);
  }
  applyTranslations();
}

// API calls carry the UI language so server messages match the page
function apiUrl(path) {
  return `${path}?lang=${encodeURIComponent(currentLang)}`;
}

// Global functions exposed to window for inline onclick reliability
window.switchTab = function(tab) {
  const tabFetchBtn = document.getElementById("tab-fetch-btn");
  const tabGenerateBtn = document.getElementById("tab-generate-btn");
  const panelFetch = document.getElementById("panel-fetch");
  const panelGenerate = document.getElementById("panel-generate");
  const inputGenFilename = document.getElementById("gen-filename");
  const inputFetchFilename = document.getElementById("fetch-filename");

  if (!tabFetchBtn || !tabGenerateBtn || !panelFetch || !panelGenerate) return;

  if (tab === "fetch") {
    tabFetchBtn.className = "tab-btn flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 text-white bg-indigo-600 shadow-md cursor-pointer select-none";
    tabGenerateBtn.className = "tab-btn flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer select-none";
    panelFetch.classList.remove("hidden");
    panelGenerate.classList.add("hidden");
    if (inputFetchFilename) setTimeout(() => inputFetchFilename.focus(), 50);
  } else {
    tabGenerateBtn.className = "tab-btn flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 text-white bg-indigo-600 shadow-md cursor-pointer select-none";
    tabFetchBtn.className = "tab-btn flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer select-none";
    panelGenerate.classList.remove("hidden");
    panelFetch.classList.add("hidden");
    if (inputGenFilename) setTimeout(() => inputGenFilename.focus(), 50);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const langSelect = document.getElementById("lang-select");

  const inputFetchFilename = document.getElementById("fetch-filename");
  const btnDoFetch = document.getElementById("btn-do-fetch");
  const fetchClearInput = document.getElementById("fetch-clear-input");
  const fetchResultCard = document.getElementById("fetch-result-card");
  const fetchErrorBox = document.getElementById("fetch-error-box");
  const fetchErrorMsg = document.getElementById("fetch-error-msg");
  const fetchPasswordText = document.getElementById("fetch-password-text");
  const fetchDisplayFilename = document.getElementById("fetch-display-filename");
  const fetchViewsLeft = document.getElementById("fetch-views-left");
  const fetchCountdown = document.getElementById("fetch-countdown");
  const btnCopyFetchedPassword = document.getElementById("btn-copy-fetched-password");

  const inputGenFilename = document.getElementById("gen-filename");
  const btnDoGenerate = document.getElementById("btn-do-generate");
  const toggleAdvancedOpts = document.getElementById("toggle-advanced-opts");
  const advancedOptsBody = document.getElementById("advanced-opts-body");
  const arrowAdvanced = document.getElementById("arrow-advanced");
  const inputGenExpireHours = document.getElementById("gen-expire-hours");
  const inputGenMaxViews = document.getElementById("gen-max-views");
  const inputGenCustomPassword = document.getElementById("gen-custom-password");
  const genResultCard = document.getElementById("gen-result-card");
  const genDisplayFilename = document.getElementById("gen-display-filename");
  const genPasswordText = document.getElementById("gen-password-text");
  const genShareUrl = document.getElementById("gen-share-url");
  const genPolicyInfo = document.getElementById("gen-policy-info");
  const btnCopyGenPassword = document.getElementById("btn-copy-gen-password");
  const btnCopyShareUrl = document.getElementById("btn-copy-share-url");
  const btnDeleteThisRecord = document.getElementById("btn-delete-this-record");

  const modalOverwrite = document.getElementById("modal-confirm-overwrite");
  const modalFilename = document.getElementById("modal-filename");
  const modalViewsLeft = document.getElementById("modal-views-left");
  const modalTimeLeft = document.getElementById("modal-time-left");
  const btnModalCancel = document.getElementById("btn-modal-cancel");
  const btnModalConfirm = document.getElementById("btn-modal-confirm");

  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");

  let countdownInterval = null;
  let pendingGenerateParams = null;
  let currentGeneratedFilename = "";

  // Language switcher
  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.addEventListener("change", () => setLanguage(langSelect.value));
  }

  // Helper: Toast notification
  function showToast(msg = t("toast.copied")) {
    if (!toast || !toastText) return;
    toastText.textContent = msg;
    toast.classList.remove("hidden", "translate-y-4", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
    setTimeout(() => {
      toast.classList.remove("translate-y-0", "opacity-100");
      toast.classList.add("translate-y-4", "opacity-0");
      setTimeout(() => toast.classList.add("hidden"), 300);
    }, 2500);
  }

  // Helper: Copy text
  async function copyText(text, btnElement = null) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      showToast(t("toast.copySuccess"));
      if (btnElement) {
        const label = btnElement.querySelector(".copy-label");
        if (label) {
          // Remember the label's own key once, so rapid repeat clicks still restore it
          const restoreKey = label.dataset.i18nDefault || label.dataset.i18n;
          label.dataset.i18nDefault = restoreKey;
          setI18n(label, "copy.done");
          setTimeout(() => {
            setI18n(label, restoreKey);
          }, 1800);
        }
      }
    } catch (err) {
      alert(t("copy.failed"));
    }
  }

  // Helper: Format seconds to HH:MM:SS
  function formatSeconds(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  function renderCountdown(totalSeconds) {
    if (totalSeconds <= 0) {
      setI18n(fetchCountdown, "time.expired");
    } else {
      setPlainText(fetchCountdown, formatSeconds(totalSeconds));
    }
  }

  // Toggle Advanced Settings Accordion
  if (toggleAdvancedOpts) {
    toggleAdvancedOpts.addEventListener("click", () => {
      if (advancedOptsBody) advancedOptsBody.classList.toggle("hidden");
      if (arrowAdvanced) arrowAdvanced.classList.toggle("rotate-180");
    });
  }

  // Preset buttons sync helpers
  const PRESET_HOUR_ACTIVE = "preset-hour-btn text-[11px] px-2 py-0.5 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 transition cursor-pointer";
  const PRESET_HOUR_INACTIVE = "preset-hour-btn text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-transparent transition cursor-pointer";

  function syncHourPresets(val) {
    const num = parseFloat(val);
    document.querySelectorAll(".preset-hour-btn").forEach((btn) => {
      const btnVal = parseFloat(btn.dataset.hours);
      if (!isNaN(num) && btnVal === num) {
        btn.className = PRESET_HOUR_ACTIVE;
      } else {
        btn.className = PRESET_HOUR_INACTIVE;
      }
    });
  }

  const PRESET_VIEW_ACTIVE = "preset-view-btn text-[11px] px-2 py-0.5 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 transition cursor-pointer";
  const PRESET_VIEW_INACTIVE = "preset-view-btn text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-transparent transition cursor-pointer";

  function syncViewPresets(val) {
    const num = parseInt(val, 10);
    document.querySelectorAll(".preset-view-btn").forEach((btn) => {
      const btnVal = parseInt(btn.dataset.views, 10);
      if (!isNaN(num) && btnVal === num) {
        btn.className = PRESET_VIEW_ACTIVE;
      } else {
        btn.className = PRESET_VIEW_INACTIVE;
      }
    });
  }

  // Preset buttons for hours
  document.querySelectorAll(".preset-hour-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (inputGenExpireHours) inputGenExpireHours.value = btn.dataset.hours;
      document.querySelectorAll(".preset-hour-btn").forEach((b) => {
        b.className = "preset-hour-btn text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer";
      });
      btn.className = "preset-hour-btn text-[11px] px-2 py-0.5 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 transition cursor-pointer";
      if (inputGenExpireHours) {
        inputGenExpireHours.value = btn.dataset.hours;
        syncHourPresets(btn.dataset.hours);
      }
    });
  });

  // Preset buttons for views
  document.querySelectorAll(".preset-view-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (inputGenMaxViews) inputGenMaxViews.value = btn.dataset.views;
      document.querySelectorAll(".preset-view-btn").forEach((b) => {
        b.className = "preset-view-btn text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer";
      });
      btn.className = "preset-view-btn text-[11px] px-2 py-0.5 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 transition cursor-pointer";
      if (inputGenMaxViews) {
        inputGenMaxViews.value = btn.dataset.views;
        syncViewPresets(btn.dataset.views);
      }
    });
  });

  // Synchronize preset button highlights when user manually inputs or edits numbers
  if (inputGenExpireHours) {
    inputGenExpireHours.addEventListener("input", () => syncHourPresets(inputGenExpireHours.value));
    inputGenExpireHours.addEventListener("change", () => syncHourPresets(inputGenExpireHours.value));
    syncHourPresets(inputGenExpireHours.value);
  }

  if (inputGenMaxViews) {
    inputGenMaxViews.addEventListener("input", () => syncViewPresets(inputGenMaxViews.value));
    inputGenMaxViews.addEventListener("change", () => syncViewPresets(inputGenMaxViews.value));
    syncViewPresets(inputGenMaxViews.value);
  }

  // Clear Input Button
  if (inputFetchFilename && fetchClearInput) {
    inputFetchFilename.addEventListener("input", () => {
      if (inputFetchFilename.value.trim().length > 0) {
        fetchClearInput.classList.remove("hidden");
      } else {
        fetchClearInput.classList.add("hidden");
      }
    });

    fetchClearInput.addEventListener("click", () => {
      inputFetchFilename.value = "";
      fetchClearInput.classList.add("hidden");
      inputFetchFilename.focus();
      if (fetchResultCard) fetchResultCard.classList.add("hidden");
      if (fetchErrorBox) fetchErrorBox.classList.add("hidden");
    });
  }

  // --- FETCH FLOW ---
  // Known error codes stay bound to their key, so the message follows later language switches
  function showFetchError(data) {
    const key = data && data.code ? `error.${data.code}` : "";
    if (key && hasMessage(key)) {
      setI18n(fetchErrorMsg, key);
    } else if (data && data.message) {
      setPlainText(fetchErrorMsg, data.message);
    } else {
      setI18n(fetchErrorMsg, "fetch.failed");
    }
    if (fetchErrorBox) fetchErrorBox.classList.remove("hidden");
  }

  async function performFetch(filename) {
    if (!filename) {
      if (inputFetchFilename) {
        inputFetchFilename.focus();
        inputFetchFilename.classList.add("ring-2", "ring-rose-500");
        setTimeout(() => inputFetchFilename.classList.remove("ring-2", "ring-rose-500"), 1500);
      }
      showToast(t("toast.enterFilenameFetch"));
      return;
    }

    if (btnDoFetch) {
      btnDoFetch.disabled = true;
      btnDoFetch.classList.add("opacity-75", "cursor-not-allowed");
    }
    if (fetchErrorBox) fetchErrorBox.classList.add("hidden");
    if (fetchResultCard) fetchResultCard.classList.add("hidden");

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    try {
      const resp = await fetch(apiUrl("/api/fetch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        showFetchError(data);
      } else {
        // Success
        setI18n(fetchDisplayFilename, "common.file", { name: data.filename });
        if (fetchPasswordText) fetchPasswordText.textContent = data.password;
        setI18n(fetchViewsLeft, "unit.views", { count: data.views_left });

        // Start countdown
        let remainingSecs = data.seconds_left;
        renderCountdown(remainingSecs);
        countdownInterval = setInterval(() => {
          remainingSecs--;
          renderCountdown(remainingSecs);
          if (remainingSecs <= 0) clearInterval(countdownInterval);
        }, 1000);

        if (fetchResultCard) fetchResultCard.classList.remove("hidden");
      }
    } catch (err) {
      setI18n(fetchErrorMsg, "error.network");
      if (fetchErrorBox) fetchErrorBox.classList.remove("hidden");
    } finally {
      if (btnDoFetch) {
        btnDoFetch.disabled = false;
        btnDoFetch.classList.remove("opacity-75", "cursor-not-allowed");
      }
    }
  }

  window.triggerFetch = function() {
    if (inputFetchFilename) performFetch(inputFetchFilename.value.trim());
  };

  if (btnCopyFetchedPassword) {
    btnCopyFetchedPassword.addEventListener("click", () => {
      if (fetchPasswordText) copyText(fetchPasswordText.textContent, btnCopyFetchedPassword);
    });
  }

  // --- GENERATE FLOW ---
  async function performGenerate(params) {
    if (btnDoGenerate) {
      btnDoGenerate.disabled = true;
      btnDoGenerate.classList.add("opacity-75", "cursor-not-allowed");
    }

    try {
      const resp = await fetch(apiUrl("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await resp.json();

      // Check if anti-misoperation confirmation is triggered
      if (data.code === "EXISTS") {
        pendingGenerateParams = { ...params, force: true };
        if (modalFilename) modalFilename.textContent = data.existing.filename;
        setI18n(modalViewsLeft, "modal.viewsValue", { left: data.existing.views_left, count: data.existing.max_views });
        const minsLeft = Math.ceil(data.existing.seconds_left / 60);
        setI18n(modalTimeLeft, "unit.minutes", { count: minsLeft });

        if (modalOverwrite) modalOverwrite.classList.remove("hidden");
        return;
      }

      if (!resp.ok || !data.ok) {
        alert(data.message || t("gen.failed"));
        return;
      }

      // Success
      currentGeneratedFilename = data.filename;
      setI18n(genDisplayFilename, "common.file", { name: data.filename });
      if (genPasswordText) genPasswordText.textContent = data.password;
      if (genShareUrl) genShareUrl.value = data.share_url;
      setI18n(genPolicyInfo, "gen.policy", { hours: data.expire_hours, views: data.max_views });

      if (genResultCard) {
        genResultCard.classList.remove("hidden");
        genResultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      if (data.is_overwrite) {
        showToast(t("toast.overwritten"));
      } else {
        showToast(t("toast.generated"));
      }
    } catch (err) {
      alert(t("error.networkRetry"));
    } finally {
      if (btnDoGenerate) {
        btnDoGenerate.disabled = false;
        btnDoGenerate.classList.remove("opacity-75", "cursor-not-allowed");
      }
    }
  }

  window.triggerGenerate = function() {
    if (!inputGenFilename) return;
    const filename = inputGenFilename.value.trim();
    if (!filename) {
      inputGenFilename.focus();
      inputGenFilename.classList.add("ring-2", "ring-rose-500");
      setTimeout(() => inputGenFilename.classList.remove("ring-2", "ring-rose-500"), 1500);
      showToast(t("toast.enterFilenameGen"));
      return;
    }

    const expire_hours = parseFloat(inputGenExpireHours.value) || 2;
    const max_views = parseInt(inputGenMaxViews.value, 10) || 1;
    const custom_password = inputGenCustomPassword.value.trim() || null;

    const params = {
      filename,
      force: false,
      expire_hours,
      max_views,
      custom_password,
    };

    performGenerate(params);
  };

  // Modal actions
  if (btnModalCancel) {
    btnModalCancel.addEventListener("click", () => {
      if (modalOverwrite) modalOverwrite.classList.add("hidden");
      pendingGenerateParams = null;
    });
  }

  if (btnModalConfirm) {
    btnModalConfirm.addEventListener("click", () => {
      if (modalOverwrite) modalOverwrite.classList.add("hidden");
      if (pendingGenerateParams) {
        performGenerate(pendingGenerateParams);
        pendingGenerateParams = null;
      }
    });
  }

  // Copy buttons in Generate panel
  if (btnCopyGenPassword) {
    btnCopyGenPassword.addEventListener("click", () => {
      if (genPasswordText) copyText(genPasswordText.textContent, btnCopyGenPassword);
    });
  }

  if (btnCopyShareUrl) {
    btnCopyShareUrl.addEventListener("click", () => {
      if (genShareUrl) copyText(genShareUrl.value, btnCopyShareUrl);
    });
  }

  // Manual delete button
  if (btnDeleteThisRecord) {
    btnDeleteThisRecord.addEventListener("click", async () => {
      if (!currentGeneratedFilename) return;
      const ok = confirm(t("confirm.delete", { name: currentGeneratedFilename }));
      if (!ok) return;

      try {
        const resp = await fetch(apiUrl("/api/clear"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: currentGeneratedFilename }),
        });
        const data = await resp.json();
        if (data.ok) {
          showToast(t("toast.cleared"));
          if (genResultCard) genResultCard.classList.add("hidden");
          if (inputGenFilename) inputGenFilename.value = "";
        } else {
          alert(data.message || t("clear.failed"));
        }
      } catch (err) {
        alert(t("error.requestFailed"));
      }
    });
  }

  // Submit forms via Enter key
  const formFetch = document.getElementById("form-fetch");
  if (formFetch) {
    formFetch.addEventListener("submit", (e) => {
      e.preventDefault();
      window.triggerFetch();
    });
  }

  const formGenerate = document.getElementById("form-generate");
  if (formGenerate) {
    formGenerate.addEventListener("submit", (e) => {
      e.preventDefault();
      window.triggerGenerate();
    });
  }

  // Auto-fill from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialFile = urlParams.get("f") || urlParams.get("file");
  if (initialFile) {
    if (inputFetchFilename) inputFetchFilename.value = initialFile;
    if (fetchClearInput) fetchClearInput.classList.remove("hidden");
    window.switchTab("fetch");
    performFetch(initialFile);
  }
});
