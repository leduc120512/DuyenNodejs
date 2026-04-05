const toggleBtn = document.getElementById("chatbot-toggle");
const closeBtn = document.getElementById("chatbot-close");
const chatbotBox = document.getElementById("chatbot-box");
const chatbotForm = document.getElementById("chatbot-form");
const chatbotInput = document.getElementById("chatbot-input");
const chatbotMessages = document.getElementById("chatbot-messages");

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    chatbotBox.classList.toggle("hidden");
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

  return `
    <div class="chat-product-card" style="border: 0.0625rem solid #e5e7eb; border-radius: 0.75rem; padding: 0.75rem; margin-top: 0.75rem;">
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
    </div>
  `;
}

function renderProducts(products = []) {
  if (!Array.isArray(products) || products.length === 0) return "";
  return products.map(renderProductCard).join("");
}

if (chatbotForm) {
  chatbotForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = chatbotInput.value.trim();
    if (!message) return;

    addMessage(message, "user");
    chatbotInput.value = "";

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
