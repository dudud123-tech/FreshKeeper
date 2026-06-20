const STORAGE_KEY = "fresh-keeper-items-v1";
const SAMPLE_RECEIPT_IMAGE = "ocr_test.jpg";
const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const TESSERACT_OPTIONS = {
  workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
  corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js",
  langPath: "https://tessdata.projectnaptha.com/4.0.0"
};
const SAMPLE_RECEIPT_TEXT = `연세멸균우유24EA
연세멸균우유RC
말차에스프레소
말차에스프레소
동물복지란30개
게네스홀청바지
퀴노아미숫가루
국산돈육다짐육
AKAI BOSHI쿠키어
요거트 프로즌
요거트프로즌RC
우유크림롤케익
라페르미에허니
정통 야채사각
밀크롤케익75G X8
미국쇠고기다짐육
말랑말랑꿀모랑
말랑꿀모링RC`;
const categories = ["유제품", "육류/생선", "채소/과일", "냉동식품", "가공식품", "소스류", "음료", "간식", "기타"];
const keywordMap = {
  "유제품": ["우유", "멸균", "요거트", "요구르트", "치즈", "버터", "크림", "두유"],
  "육류/생선": ["고기", "삼겹", "목살", "한우", "소고기", "돼지", "닭", "계란", "달걀", "생선", "연어", "참치", "고등어"],
  "채소/과일": ["사과", "바나나", "딸기", "포도", "토마토", "상추", "양파", "감자", "고구마", "당근", "오이", "샐러드"],
  "냉동식품": ["냉동", "만두", "피자", "아이스", "튀김"],
  "가공식품": ["라면", "햇반", "김치", "두부", "통조림", "스팸", "어묵"],
  "소스류": ["소스", "케찹", "케첩", "마요", "마요네즈", "머스타드", "초고추장", "드레싱", "굴소스", "고추장", "된장", "쌈장", "간장", "참기름", "들기름", "식초", "올리고당", "물엿"],
  "음료": ["물", "커피", "주스", "콜라", "사이다", "맥주", "소주", "음료"],
  "간식": ["과자", "초콜릿", "쿠키", "빵", "케이크", "롤케익", "젤리"]
};

const state = {
  items: loadItems(),
  filter: "all",
  photoDataUrl: "",
  receiptImageSource: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elements = {
  manualForm: $("#manualForm"),
  itemName: $("#itemName"),
  itemCategory: $("#itemCategory"),
  itemStorage: $("#itemStorage"),
  itemExpiryType: $("#itemExpiryType"),
  itemExpiry: $("#itemExpiry"),
  receiptImageInput: $("#receiptImageInput"),
  receiptImagePreview: $("#receiptImagePreview"),
  ocrStatus: $("#ocrStatus"),
  receiptText: $("#receiptText"),
  receiptDrafts: $("#receiptDrafts"),
  photoInput: $("#photoInput"),
  photoPreview: $("#photoPreview"),
  photoName: $("#photoName"),
  photoCategory: $("#photoCategory"),
  photoExpiryType: $("#photoExpiryType"),
  photoExpiry: $("#photoExpiry"),
  itemList: $("#itemList"),
  emptyState: $("#emptyState"),
  filterSelect: $("#filterSelect"),
  urgentCount: $("#urgentCount"),
  totalCount: $("#totalCount"),
  todayCount: $("#todayCount"),
  notificationButton: $("#notificationButton")
};

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysUntil(dateValue) {
  const target = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((target - todayStart()) / 86400000);
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
}

function suggestCategory(name) {
  const normalized = name.replace(/\s/g, "").toLowerCase();
  for (const [category, words] of Object.entries(keywordMap)) {
    if (words.some((word) => normalized.includes(word.toLowerCase()))) {
      return category;
    }
  }
  return "기타";
}

function createItem({ name, category, storage = "냉장", expiryType = "유통기한", expiry, photo = "" }) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name: name.trim(),
    category,
    storage,
    expiryType,
    expiry,
    photo,
    createdAt: new Date().toISOString()
  };
}

function addItem(item) {
  if (!item.name || !item.expiry) {
    alert("상품명과 날짜를 입력해 주세요.");
    return false;
  }
  state.items.unshift(item);
  saveItems();
  render();
  scheduleNotificationCheck();
  return true;
}

function removeItem(id) {
  state.items = state.items.filter((item) => item.id !== id);
  saveItems();
  render();
}

function consumeItem(id) {
  removeItem(id);
}

function populateCategories() {
  [elements.itemCategory, elements.photoCategory].forEach((select) => {
    select.innerHTML = categories.map((category) => `<option>${category}</option>`).join("");
  });
}

function setDefaultDates() {
  const tomorrow = new Date(Date.now() + 86400000);
  const nextWeek = new Date(Date.now() + 7 * 86400000);
  elements.itemExpiry.valueAsDate = nextWeek;
  elements.photoExpiry.valueAsDate = tomorrow;
}

function switchPanel(mode) {
  $$(".segment").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  $$("[data-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== mode));
}

function parseReceiptLines(text) {
  const seen = new Set();
  return text
    .split(/\n+/)
    .map(cleanReceiptLine)
    .filter((line) => line.length >= 2)
    .filter((line) => {
      const seenKey = line.replace(/\s/g, "").replace(/[ㄱ-ㅎㅏ-ㅣ]/g, "").replace(/\d/g, "").toLowerCase();
      if (seen.has(seenKey)) return false;
      seen.add(seenKey);
      return true;
    })
    .slice(0, 20);
}

function cleanReceiptLine(line) {
  const blockedWords = /(COSTCO|WHOLESALE|코스트코|대표자|대구시|판매|합계|소계|면세|과세|부가세|거래|구매|승인|카드|잔돈|쿠폰|상품 수|REG|PM|VAT|번호)/i;
  let cleaned = line
    .replace(/[|｜]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  cleaned = cleaned
    .replace(/(?<=[가-힣])\s+(?=[가-힣])/g, "")
    .replace(/(?<=[가-힣])\s+(?=\d)/g, "")
    .replace(/(?<=\d)\s+(?=[가-힣A-Za-z])/g, "");

  if (!cleaned || blockedWords.test(cleaned)) return "";
  if (/^\d/.test(cleaned)) return "";
  if (/^\*?\s*CPN$/i.test(cleaned)) return "";
  if (/^[A-Z0-9\s]{6,}$/i.test(cleaned) && !/[가-힣]/.test(cleaned)) return "";
  if (/\d{1,3}\s*,?\d{3}/.test(cleaned)) return "";
  if (/RC$/i.test(cleaned.replace(/\s/g, ""))) return "";

  cleaned = cleaned
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\b\d{1,4}\b(?!\s*(개|g|G|ea|EA|x|X))/g, "")
    .replace(/\b[0-9A-Z]{1,2}\b$/i, "")
    .replace(/[ㄱ-ㅎㅏ-ㅣ]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!/[가-힣A-Za-z]/.test(cleaned)) return "";
  if (cleaned.length < 2) return "";

  return cleaned;
}

function showReceiptImage(src, altText = "선택한 영수증 이미지") {
  state.receiptImageSource = src;
  elements.receiptImagePreview.innerHTML = `<img src="${src}" alt="${altText}" />`;
}

function getReceiptImageForOcr() {
  const previewImage = elements.receiptImagePreview.querySelector("img");
  return previewImage || state.receiptImageSource;
}

function setOcrStatus(message, busy = false) {
  elements.ocrStatus.textContent = message;
  elements.ocrStatus.classList.toggle("busy", busy);
}

function formatOcrError(error) {
  const detail = error && error.message ? ` (${error.message})` : "";
  if (!navigator.onLine) {
    return "OCR 파일을 내려받을 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
  }
  if (location.protocol === "file:") {
    return `브라우저가 로컬 파일 모드에서 OCR 파일 로딩을 막았을 수 있습니다. 로컬 서버로 열어 다시 시도해 주세요.${detail}`;
  }
  return `OCR 실행에 실패했습니다. 잠시 후 다시 시도하거나 샘플 OCR을 사용해 보세요.${detail}`;
}

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${TESSERACT_CDN}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.Tesseract), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TESSERACT_CDN;
    script.async = true;
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error("OCR 라이브러리를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

function applyOcrText(text) {
  elements.receiptText.value = text.trim();
  renderDrafts(parseReceiptLines(text));
}

async function runReceiptOcr() {
  if (!state.receiptImageSource) {
    alert("먼저 영수증 이미지를 선택하거나 샘플을 불러오세요.");
    return;
  }

  const button = $("#runOcrButton");
  button.disabled = true;
  setOcrStatus("OCR 준비 중입니다. 처음 실행은 시간이 조금 걸릴 수 있습니다.", true);

  try {
    const Tesseract = await loadTesseract();
    const result = await Tesseract.recognize(getReceiptImageForOcr(), "kor+eng", {
      ...TESSERACT_OPTIONS,
      logger: (message) => {
        if (message.status === "recognizing text") {
          const percent = Math.round((message.progress || 0) * 100);
          setOcrStatus(`글자를 읽는 중입니다. ${percent}%`, true);
        } else if (message.status) {
          setOcrStatus(`OCR 처리 중: ${message.status}`, true);
        }
      }
    });
    applyOcrText(result.data.text || "");
    setOcrStatus("OCR 완료. 아래 후보 목록을 확인하세요.");
  } catch (error) {
    console.error(error);
    setOcrStatus(formatOcrError(error));
  } finally {
    button.disabled = false;
  }
}

function renderDrafts(lines) {
  elements.receiptDrafts.innerHTML = "";
  if (!lines.length) {
    elements.receiptDrafts.innerHTML = '<p class="empty-state">상품명을 찾지 못했습니다. 줄마다 상품명을 입력해 보세요.</p>';
    return;
  }

  const template = $("#draftTemplate");
  lines.forEach((name) => {
    const category = suggestCategory(name);
    const node = template.content.cloneNode(true);
    node.querySelector("[data-draft-name]").textContent = name;
    node.querySelector("[data-draft-category]").textContent = category;
    const expiryTypeInput = node.querySelector("[data-draft-expiry-type]");
    const expiryInput = node.querySelector("[data-draft-expiry]");
    expiryInput.valueAsDate = new Date(Date.now() + 7 * 86400000);
    node.querySelector("[data-draft-add]").addEventListener("click", () => {
      const added = addItem(createItem({ name, category, expiryType: expiryTypeInput.value, expiry: expiryInput.value }));
      if (added) {
        expiryInput.closest(".draft-item").remove();
      }
    });
    elements.receiptDrafts.appendChild(node);
  });
}

function filteredItems() {
  const sorted = [...state.items].sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
  if (state.filter === "all") return sorted;
  if (state.filter === "urgent") return sorted.filter((item) => daysUntil(item.expiry) >= 0 && daysUntil(item.expiry) <= 3);
  if (state.filter === "expired") return sorted.filter((item) => daysUntil(item.expiry) < 0);
  return sorted.filter((item) => item.storage === state.filter);
}

function statusFor(item) {
  const days = daysUntil(item.expiry);
  if (days < 0) return { text: `${Math.abs(days)}일 지남`, className: "expired" };
  if (days === 0) return { text: "오늘까지", className: "warning" };
  if (days <= 3) return { text: `D-${days}`, className: "warning" };
  return { text: `D-${days}`, className: "" };
}

function renderItems() {
  elements.itemList.innerHTML = "";
  const items = filteredItems();
  elements.emptyState.classList.toggle("hidden", items.length > 0);

  const template = $("#itemTemplate");
  items.forEach((item) => {
    const node = template.content.cloneNode(true);
    const status = statusFor(item);
    const statusEl = node.querySelector("[data-status]");
    const photoEl = node.querySelector("[data-photo]");

    node.querySelector("[data-name]").textContent = item.name;
    statusEl.textContent = status.text;
    statusEl.className = status.className;
    node.querySelector("[data-meta]").textContent = `${item.category} · ${item.storage} · ${item.expiryType || "유통기한"} ${formatDate(item.expiry)}`;
    if (item.photo) {
      photoEl.src = item.photo;
      photoEl.classList.remove("hidden");
    }
    node.querySelector("[data-consume]").addEventListener("click", () => consumeItem(item.id));
    node.querySelector("[data-delete]").addEventListener("click", () => removeItem(item.id));
    elements.itemList.appendChild(node);
  });
}

function renderSummary() {
  const counts = state.items.reduce(
    (acc, item) => {
      const days = daysUntil(item.expiry);
      acc.total += 1;
      if (days >= 0 && days <= 3) acc.urgent += 1;
      if (days === 0) acc.today += 1;
      return acc;
    },
    { total: 0, urgent: 0, today: 0 }
  );
  elements.totalCount.textContent = counts.total;
  elements.urgentCount.textContent = counts.urgent;
  elements.todayCount.textContent = counts.today;
}

function render() {
  renderSummary();
  renderItems();
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    alert("이 브라우저에서는 알림을 지원하지 않습니다.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    new Notification("유통기한 매니저", { body: "알림이 켜졌습니다. 앱이 열려 있을 때 임박 상품을 알려드릴게요." });
  }
}

function scheduleNotificationCheck() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const urgentItems = state.items.filter((item) => {
    const days = daysUntil(item.expiry);
    return days >= 0 && days <= 1;
  });
  if (!urgentItems.length) return;
  const names = urgentItems.slice(0, 3).map((item) => item.name).join(", ");
  window.setTimeout(() => {
    new Notification("기한 임박", { body: `${names} 확인이 필요합니다.` });
  }, 700);
}

function bindEvents() {
  $$(".segment").forEach((button) => {
    button.addEventListener("click", () => switchPanel(button.dataset.mode));
  });

  elements.itemName.addEventListener("input", () => {
    elements.itemCategory.value = suggestCategory(elements.itemName.value);
  });

  elements.photoName.addEventListener("input", () => {
    elements.photoCategory.value = suggestCategory(elements.photoName.value);
  });

  elements.manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const added = addItem(
      createItem({
        name: elements.itemName.value,
        category: elements.itemCategory.value,
        storage: elements.itemStorage.value,
        expiryType: elements.itemExpiryType.value,
        expiry: elements.itemExpiry.value
      })
    );
    if (added) {
      elements.manualForm.reset();
      setDefaultDates();
      elements.itemName.focus();
    }
  });

  $("#parseReceiptButton").addEventListener("click", () => {
    renderDrafts(parseReceiptLines(elements.receiptText.value));
  });

  elements.receiptImageInput.addEventListener("change", () => {
    const file = elements.receiptImageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => showReceiptImage(reader.result);
    reader.readAsDataURL(file);
  });

  $("#loadSampleReceiptButton").addEventListener("click", () => {
    showReceiptImage(SAMPLE_RECEIPT_IMAGE, "ocr_test.jpg 샘플 영수증");
  });

  $("#fillSampleOcrButton").addEventListener("click", () => {
    applyOcrText(SAMPLE_RECEIPT_TEXT);
    setOcrStatus("샘플 OCR 결과를 적용했습니다.");
  });

  $("#runOcrButton").addEventListener("click", runReceiptOcr);

  elements.photoInput.addEventListener("change", () => {
    const file = elements.photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.photoDataUrl = reader.result;
      elements.photoPreview.innerHTML = `<img src="${reader.result}" alt="선택한 상품 사진" />`;
    };
    reader.readAsDataURL(file);
  });

  $("#addPhotoItemButton").addEventListener("click", () => {
    const added = addItem(
      createItem({
        name: elements.photoName.value,
        category: elements.photoCategory.value,
        expiryType: elements.photoExpiryType.value,
        expiry: elements.photoExpiry.value,
        photo: state.photoDataUrl
      })
    );
    if (added) {
      state.photoDataUrl = "";
      elements.photoName.value = "";
      elements.photoInput.value = "";
      elements.photoExpiry.valueAsDate = new Date(Date.now() + 86400000);
      elements.photoPreview.textContent = "사진을 선택하면 미리보기가 표시됩니다";
    }
  });

  elements.filterSelect.addEventListener("change", () => {
    state.filter = elements.filterSelect.value;
    renderItems();
  });

  elements.notificationButton.addEventListener("click", requestNotifications);
}

populateCategories();
setDefaultDates();
bindEvents();
render();
if (location.protocol === "file:") {
  setOcrStatus("OCR은 로컬 파일 모드에서 실패할 수 있습니다. 실패하면 start-server.ps1로 로컬 서버를 열어 테스트하세요.");
}
scheduleNotificationCheck();
