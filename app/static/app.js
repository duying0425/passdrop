// PassDrop Client-side Logic
document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const tabFetchBtn = document.getElementById("tab-fetch-btn");
  const tabGenerateBtn = document.getElementById("tab-generate-btn");
  const panelFetch = document.getElementById("panel-fetch");
  const panelGenerate = document.getElementById("panel-generate");

  // Fetch Panel Elements
  const formFetch = document.getElementById("form-fetch");
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

  // Generate Panel Elements
  const formGenerate = document.getElementById("form-generate");
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

  // Modal Elements
  const modalOverwrite = document.getElementById("modal-confirm-overwrite");
  const modalFilename = document.getElementById("modal-filename");
  const modalViewsLeft = document.getElementById("modal-views-left");
  const modalTimeLeft = document.getElementById("modal-time-left");
  const btnModalCancel = document.getElementById("btn-modal-cancel");
  const btnModalConfirm = document.getElementById("btn-modal-confirm");

  // Toast
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");

  let countdownInterval = null;
  let pendingGenerateParams = null;
  let currentGeneratedFilename = "";

  // Helper: Toast notification
  function showToast(msg = "已复制到剪贴板") {
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

  // Switch Tabs
  function switchTab(tab) {
    if (tab === "fetch") {
      tabFetchBtn.className = "tab-btn flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 text-white bg-indigo-600 shadow-md";
      tabGenerateBtn.className = "tab-btn flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200";
      panelFetch.classList.remove("hidden");
      panelGenerate.classList.add("hidden");
    } else {
      tabGenerateBtn.className = "tab-btn flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 text-white bg-indigo-600 shadow-md";
      tabFetchBtn.className = "tab-btn flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200";
      panelGenerate.classList.remove("hidden");
      panelFetch.classList.add("hidden");
    }
  }

  tabFetchBtn.addEventListener("click", () => switchTab("fetch"));
  tabGenerateBtn.addEventListener("click", () => switchTab("generate"));

  // Toggle Advanced Settings Accordion
  toggleAdvancedOpts.addEventListener("click", () => {
    advancedOptsBody.classList.toggle("hidden");
    arrowAdvanced.classList.toggle("rotate-180");
  });

  // Clear Input Button
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
    fetchResultCard.classList.add("hidden");
    fetchErrorBox.classList.add("hidden");
  });

  // --- FETCH FLOW ---
  async function performFetch(filename) {
    if (!filename) {
      inputFetchFilename.focus();
      return;
    }

    btnDoFetch.disabled = true;
    btnDoFetch.classList.add("opacity-75", "cursor-not-allowed");
    fetchErrorBox.classList.add("hidden");
    fetchResultCard.classList.add("hidden");

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
        fetchErrorMsg.textContent = data.message || "获取失败，密码可能不存在或已过期";
        fetchErrorBox.classList.remove("hidden");
      } else {
        // Success
        fetchDisplayFilename.textContent = `文件：${data.filename}`;
        fetchPasswordText.textContent = data.password;
        fetchViewsLeft.textContent = `${data.views_left} 次`;

        // Start countdown
        let remainingSecs = data.seconds_left;
        fetchCountdown.textContent = formatSeconds(remainingSecs);
        countdownInterval = setInterval(() => {
          remainingSecs--;
          if (remainingSecs <= 0) {
            fetchCountdown.textContent = "已过期";
            clearInterval(countdownInterval);
          } else {
            fetchCountdown.textContent = formatSeconds(remainingSecs);
          }
        }, 1000);

        fetchResultCard.classList.remove("hidden");
      }
    } catch (err) {
      fetchErrorMsg.textContent = "网络请求失败，请检查网络或服务器状态";
      fetchErrorBox.classList.remove("hidden");
    } finally {
      btnDoFetch.disabled = false;
      btnDoFetch.classList.remove("opacity-75", "cursor-not-allowed");
    }
  }

  formFetch.addEventListener("submit", (e) => {
    e.preventDefault();
    performFetch(inputFetchFilename.value.trim());
  });

  btnCopyFetchedPassword.addEventListener("click", () => {
    copyText(fetchPasswordText.textContent, btnCopyFetchedPassword);
  });

  // --- GENERATE FLOW ---
  async function performGenerate(params) {
    btnDoGenerate.disabled = true;
    btnDoGenerate.classList.add("opacity-75", "cursor-not-allowed");

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
        modalFilename.textContent = data.existing.filename;
        modalViewsLeft.textContent = `${data.existing.views_left} / ${data.existing.max_views} 次`;
        const minsLeft = Math.ceil(data.existing.seconds_left / 60);
        modalTimeLeft.textContent = `${minsLeft} 分钟`;

        modalOverwrite.classList.remove("hidden");
        return;
      }

      if (!resp.ok || !data.ok) {
        alert(data.message || "生成密码失败");
        return;
      }

      // Success
      currentGeneratedFilename = data.filename;
      genDisplayFilename.textContent = `文件：${data.filename}`;
      genPasswordText.textContent = data.password;
      genShareUrl.value = data.share_url;
      genPolicyInfo.textContent = `⏳ 有效期：${data.expire_hours} 小时 | 最大提取 ${data.max_views} 次`;

      genResultCard.classList.remove("hidden");
      genResultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });

      if (data.is_overwrite) {
        showToast("旧记录已清除，已生成全新密码！");
      } else {
        showToast("密码已生成并生效！");
      }
    } catch (err) {
      alert("网络连接异常，请重试");
    } finally {
      btnDoGenerate.disabled = false;
      btnDoGenerate.classList.remove("opacity-75", "cursor-not-allowed");
    }
  }

  formGenerate.addEventListener("submit", (e) => {
    e.preventDefault();
    const filename = inputGenFilename.value.trim();
    if (!filename) {
      inputGenFilename.focus();
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
  });

  // Modal actions
  btnModalCancel.addEventListener("click", () => {
    modalOverwrite.classList.add("hidden");
    pendingGenerateParams = null;
  });

  btnModalConfirm.addEventListener("click", () => {
    modalOverwrite.classList.add("hidden");
    if (pendingGenerateParams) {
      performGenerate(pendingGenerateParams);
      pendingGenerateParams = null;
    }
  });

  // Copy buttons in Generate panel
  btnCopyGenPassword.addEventListener("click", () => {
    copyText(genPasswordText.textContent, btnCopyGenPassword);
  });

  btnCopyShareUrl.addEventListener("click", () => {
    copyText(genShareUrl.value, btnCopyShareUrl);
  });

  // Manual delete button
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
        genResultCard.classList.add("hidden");
        inputGenFilename.value = "";
      } else {
        alert(data.message || "清除失败");
      }
    } catch (err) {
      alert("请求失败，请稍后重试");
    }
  });

  // Auto-fill from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialFile = urlParams.get("f") || urlParams.get("file");
  if (initialFile) {
    inputFetchFilename.value = initialFile;
    fetchClearInput.classList.remove("hidden");
    switchTab("fetch");
    // Automatically trigger fetch if filename provided in URL
    performFetch(initialFile);
  }
});
