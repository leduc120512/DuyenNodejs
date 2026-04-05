const toggleBtn = document.getElementById("chatbot-toggle");
const closeBtn = document.getElementById("chatbot-close");
const chatbotBox = document.getElementById("chatbot-box");
const chatbotForm = document.getElementById("chatbot-form");
const chatbotInput = document.getElementById("chatbot-input");
const chatbotMessages = document.getElementById("chatbot-messages");
let topViewedLoaded = false;

const chatbotSuggestBox = document.createElement("div");
chatbotSuggestBox.id = "chatbot-suggest-box";
chatbotSuggestBox.style.marginTop = "0.4rem";
chatbotSuggestBox.style.display = "none";

if (chatbotForm) {
  chatbotForm.appendChild(chatbotSuggestBox);
}

if (toggleBtn) {
  toggleBtn.addEventListener("click", async () => {
    chatbotBox.classList.toggle("hidden");

    if (!chatbotBox.classList.contains("hidden") && !topViewedLoaded) {
      await loadTopViewedProducts();
      topViewedLoaded = true;
    }
  });
}

if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    chatbotBox.classList.add("hidden");
  });
}

function formatPrice(price) {
  return Number(price || 0).toLocaleString("vi-VN");
}

function addMessage(content, type = "bot") {
  const div = document.createElement("div");
  div.className = type === "user" ? "user-message" : "bot-message";
  div.innerHTML = content;
  chatbotMessages.appendChild(div);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function renderProductCard(product) {
  const scorePercent = product.score ? (product.score * 100).toFixed(1) : "0.0";
  const colors = Array.isArray(product.color) ? product.color.join(", ") : "";
  const sizes = Array.isArray(product.size) ? product.size.join(", ") : "";
  const productId = String(product._id || "").trim();

  if (!productId) {
    return "";
  }

  return `
    <a href="/products/${encodeURIComponent(productId)}" class="chat-product-card" style="display:block;text-decoration:none;color:inherit;border:0.0625rem solid #e5e7eb;border-radius:0.75rem;padding:0.75rem;margin-top:0.75rem;">
      <img
        src="${product.image || "/images/default-product.jpg"}"
        alt="${product.name}"
        style="width: 100%; max-height: 10rem; object-fit: cover; border-radius: 0.5rem;"
      />
      <div style="margin-top: 0.5rem; font-weight: 700;">${product.name}</div>
      <div style="margin-top: 0.25rem;">Giá: ${formatPrice(
        product.price,
      )} đ</div>
      <div style="margin-top: 0.25rem;">Màu: ${colors || "Đang cập nhật"}</div>
      <div style="margin-top: 0.25rem;">Size: ${sizes || "Đang cập nhật"}</div>
      <div style="margin-top: 0.25rem;">Độ phù hợp: ${scorePercent}%</div>
    </a>
  `;
}

function renderProducts(products = []) {
  if (!Array.isArray(products) || products.length === 0) return "";
  return products.map(renderProductCard).join("");
}

async function fetchSearchSuggestions(keyword = "") {
  const res = await fetch(
    `/api/ai-search/history?q=${encodeURIComponent(keyword)}`,
  );

  if (!res.ok) {
    throw new Error(`Suggest API ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data?.suggestions) ? data.suggestions : [];
}

async function loadTopViewedProducts() {
  try {
    const suggestions = await fetchSearchSuggestions("");
    const topViewed = suggestions
      .filter((item) => item.type === "top_viewed" && item.product)
      .slice(0, 3)
      .map((item) => item.product);

    if (!topViewed.length) {
      return;
    }

    addMessage(`
      <div><strong>Top 3 sản phẩm xem nhiều nhất</strong> (khách chưa đăng nhập vẫn xem được):</div>
      <div style="margin-top: 0.5rem;">
        ${renderProducts(topViewed)}
      </div>
    `);
  } catch (error) {
    console.error("TOP VIEWED SUGGEST ERROR:", error);
  }
}

function renderChatbotSuggestChips(suggestions = []) {
  const chips = suggestions
    .slice(0, 6)
    .map((item) => {
      const keyword = String(item.keyword || item.product?.name || "").trim();
      if (!keyword) return "";

      return `<button type="button" class="chatbot-suggest-chip" data-keyword="${keyword.replace(/"/g, "&quot;")}" style="border:1px solid #e5e7eb;background:#fff;padding:6px 10px;border-radius:999px;font-size:12px;cursor:pointer;">${keyword}</button>`;
    })
    .filter(Boolean)
    .join("");

  if (!chips) {
    chatbotSuggestBox.style.display = "none";
    chatbotSuggestBox.innerHTML = "";
    return;
  }

  chatbotSuggestBox.style.display = "flex";
  chatbotSuggestBox.style.flexWrap = "wrap";
  chatbotSuggestBox.style.gap = "6px";
  chatbotSuggestBox.innerHTML = chips;
}

let suggestDebounce = null;

if (chatbotInput) {
  chatbotInput.addEventListener("input", () => {
    clearTimeout(suggestDebounce);
    suggestDebounce = setTimeout(async () => {
      const keyword = chatbotInput.value.trim();
      if (!keyword) {
        chatbotSuggestBox.style.display = "none";
        chatbotSuggestBox.innerHTML = "";
        return;
      }

      try {
        const suggestions = await fetchSearchSuggestions(keyword);
        renderChatbotSuggestChips(suggestions);
      } catch (error) {
        console.error("CHATBOT SUGGEST ERROR:", error);
      }
    }, 220);
  });
}

if (chatbotSuggestBox) {
  chatbotSuggestBox.addEventListener("click", (event) => {
    const chip = event.target.closest(".chatbot-suggest-chip");
    if (!chip || !chatbotInput) return;

    const keyword = chip.getAttribute("data-keyword") || "";
    chatbotInput.value = keyword;
    chatbotInput.focus();
    chatbotSuggestBox.style.display = "none";
  });
}

if (chatbotForm) {
  chatbotForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = chatbotInput.value.trim();
    if (!message) return;

    addMessage(message, "user");
    chatbotInput.value = "";
    chatbotSuggestBox.style.display = "none";
    chatbotSuggestBox.innerHTML = "";

    try {
      const res = await fetch("/api/ai-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (!data.ok) {
        addMessage(data.message || "Có lỗi xảy ra khi tìm kiếm.");
        return;
      }

      if (!data.products || data.products.length === 0) {
        addMessage("Không tìm thấy sản phẩm phù hợp.");
        return;
      }

      addMessage(`
        <div>${data.reply}</div>
        <div style="margin-top: 0.5rem;">
          ${renderProducts(data.products)}
        </div>
      `);
    } catch (error) {
      console.error("CHATBOT ERROR:", error);
      addMessage("Không thể kết nối đến hệ thống AI.");
    }
  });
}
