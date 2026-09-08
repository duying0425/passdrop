// PassDrop Client-side Logic

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

  // Helper: Toast notification
  function showToast(msg = "已复制到剪贴板") {
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
      showToast("复制成功！");
      if (btnElement) {
        const label = btnElement.querySelector(".copy-label");
        if (label) {
          const original = label.textContent;
          label.textContent = "已复制!";
          setTimeout(() => {
            label.textContent = original;
          }, 1800);
        }
      }
    } catch (err) {
      alert("复制失败，请手动选择复制。");
    }
  }

  // Helper: Format seconds to HH:MM:SS
  function formatSeconds(totalSeconds) {
    if (totalSeconds <= 0) return "已过期";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
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
  async function performFetch(filename) {
    if (!filename) {
      if (inputFetchFilename) {
        inputFetchFilename.focus();
        inputFetchFilename.classList.add("ring-2", "ring-rose-500");
        setTimeout(() => inputFetchFilename.classList.remove("ring-2", "ring-rose-500"), 1500);
      }
      showToast("请输入文件名后再提取！");
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
      const resp = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        if (fetchErrorMsg) fetchErrorMsg.textContent = data.message || "获取失败，密码可能不存在或已过期";
        if (fetchErrorBox) fetchErrorBox.classList.remove("hidden");
      } else {
        // Success
        if (fetchDisplayFilename) fetchDisplayFilename.textContent = `文件：${data.filename}`;
        if (fetchPasswordText) fetchPasswordText.textContent = data.password;
        if (fetchViewsLeft) fetchViewsLeft.textContent = `${data.views_left} 次`;

        // Start countdown
        let remainingSecs = data.seconds_left;
        if (fetchCountdown) fetchCountdown.textContent = formatSeconds(remainingSecs);
        countdownInterval = setInterval(() => {
          remainingSecs--;
          if (remainingSecs <= 0) {
            if (fetchCountdown) fetchCountdown.textContent = "已过期";
            clearInterval(countdownInterval);
          } else {
            if (fetchCountdown) fetchCountdown.textContent = formatSeconds(remainingSecs);
          }
        }, 1000);

        if (fetchResultCard) fetchResultCard.classList.remove("hidden");
      }
    } catch (err) {
      if (fetchErrorMsg) fetchErrorMsg.textContent = "网络请求失败，请检查网络或服务器状态";
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
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await resp.json();

      // Check if anti-misoperation confirmation is triggered
      if (data.code === "EXISTS") {
        pendingGenerateParams = { ...params, force: true };
        if (modalFilename) modalFilename.textContent = data.existing.filename;
        if (modalViewsLeft) modalViewsLeft.textContent = `${data.existing.views_left} / ${data.existing.max_views} 次`;
        const minsLeft = Math.ceil(data.existing.seconds_left / 60);
        if (modalTimeLeft) modalTimeLeft.textContent = `${minsLeft} 分钟`;

        if (modalOverwrite) modalOverwrite.classList.remove("hidden");
        return;
      }

      if (!resp.ok || !data.ok) {
        alert(data.message || "生成密码失败");
        return;
      }

      // Success
      currentGeneratedFilename = data.filename;
      if (genDisplayFilename) genDisplayFilename.textContent = `文件：${data.filename}`;
      if (genPasswordText) genPasswordText.textContent = data.password;
      if (genShareUrl) genShareUrl.value = data.share_url;
      if (genPolicyInfo) genPolicyInfo.textContent = `⏳ 有效期：${data.expire_hours} 小时 | 最大提取 ${data.max_views} 次`;

      if (genResultCard) {
        genResultCard.classList.remove("hidden");
        genResultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      if (data.is_overwrite) {
        showToast("旧记录已清除，已生成全新密码！");
      } else {
        showToast("密码已生成并生效！");
      }
    } catch (err) {
      alert("网络连接异常，请重试");
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
      showToast("请输入文件名后再生成！");
      return;
    }

    const expire_hours = parseFloat(inputGenExpireHours.value) || 2;
    const max_views = parseInt(inputGenMaxViews.value, 10) || 3;
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
      const ok = confirm(`确定要立即永久清除【${currentGeneratedFilename}】的密码记录吗？清除后他人将无法再获取解压密码。`);
      if (!ok) return;

      try {
        const resp = await fetch("/api/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: currentGeneratedFilename }),
        });
        const data = await resp.json();
        if (data.ok) {
          showToast("记录已彻底清除！");
          if (genResultCard) genResultCard.classList.add("hidden");
          if (inputGenFilename) inputGenFilename.value = "";
        } else {
          alert(data.message || "清除失败");
        }
      } catch (err) {
        alert("请求失败，请稍后重试");
      }
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
