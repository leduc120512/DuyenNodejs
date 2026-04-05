const axios = require("axios");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const HEALTH_CACHE_TTL_MS = 30000;

let lastHealthCheck = {
  at: 0,
  ok: false,
  message: "Chua kiem tra",
};

async function getEmbedding(text) {
  const input = String(text || "").trim();

  if (!input) {
    throw new Error("Text for embedding is empty");
  }

  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/embed`,
      {
        model: OLLAMA_EMBED_MODEL,
        input,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    const data = response.data;

    if (
      !data ||
      !Array.isArray(data.embeddings) ||
      !Array.isArray(data.embeddings[0])
    ) {
      throw new Error("Invalid embedding response from Ollama");
    }

    return data.embeddings[0];
  } catch (error) {
    console.error("OLLAMA EMBED ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      baseURL: OLLAMA_BASE_URL,
      model: OLLAMA_EMBED_MODEL,
      input,
    });

    throw error;
  }
}

async function checkEmbeddingServiceReady(force = false) {
  const now = Date.now();

  if (!force && now - lastHealthCheck.at < HEALTH_CACHE_TTL_MS) {
    return lastHealthCheck;
  }

  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/embed`,
      {
        model: OLLAMA_EMBED_MODEL,
        input: "healthcheck",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    const data = response.data;
    const ok = !!(
      data &&
      Array.isArray(data.embeddings) &&
      Array.isArray(data.embeddings[0])
    );

    lastHealthCheck = {
      at: now,
      ok,
      message: ok ? "AI embedding san sang" : "Embedding response khong hop le",
    };

    return lastHealthCheck;
  } catch (error) {
    const status = error?.response?.status;
    const apiMessage = error?.response?.data?.error;
    const message = apiMessage || error.message || "Khong the ket noi Ollama";

    lastHealthCheck = {
      at: now,
      ok: false,
      message: status ? `${status} - ${message}` : message,
    };

    return lastHealthCheck;
  }
}

module.exports = {
  getEmbedding,
  checkEmbeddingServiceReady,
};
