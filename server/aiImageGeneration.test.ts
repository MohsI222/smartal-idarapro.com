import test from "node:test";
import assert from "node:assert/strict";

import {
  extractGeminiInlineImageData,
  getPreferredGeminiImageModels,
  resolveGeminiImageApiKey,
  shouldFallbackToOpenAiImageGeneration,
} from "./aiImageGeneration";

test("resolveGeminiImageApiKey prefers user key before system key", () => {
  assert.equal(
    resolveGeminiImageApiKey("  user-key  ", "system-key"),
    "user-key"
  );
  assert.equal(resolveGeminiImageApiKey("", "  system-key  "), "system-key");
  assert.equal(resolveGeminiImageApiKey("   ", "   "), null);
});

test("extractGeminiInlineImageData finds image data even when text part comes first", () => {
  const payload = {
    candidates: [
      {
        content: {
          parts: [
            { text: "Here is your generated image" },
            { inlineData: { mimeType: "image/png", data: "base64-image-data" } },
          ],
        },
      },
    ],
  };

  assert.equal(extractGeminiInlineImageData(payload), "base64-image-data");
});

test("extractGeminiInlineImageData returns null when no inline image exists", () => {
  const payload = {
    candidates: [
      {
        content: {
          parts: [{ text: "No image returned" }],
        },
      },
    ],
  };

  assert.equal(extractGeminiInlineImageData(payload), null);
});

test("extractGeminiInlineImageData supports REST snake_case image payloads", () => {
  const payload = {
    candidates: [
      {
        content: {
          parts: [
            {
              inline_data: {
                mime_type: "image/png",
                data: "rest-base64-image",
              },
            },
          ],
        },
      },
    ],
  };

  assert.equal(extractGeminiInlineImageData(payload), "rest-base64-image");
});

test("getPreferredGeminiImageModels returns supported production-first fallback order", () => {
  assert.deepEqual(getPreferredGeminiImageModels(), [
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
  ]);
});

test("shouldFallbackToOpenAiImageGeneration accepts model and service runtime failures", () => {
  assert.equal(
    shouldFallbackToOpenAiImageGeneration("Model gemini-2.0-flash-exp-image-generation not found"),
    true
  );
  assert.equal(
    shouldFallbackToOpenAiImageGeneration("Internal error 500 from Gemini API"),
    true
  );
  assert.equal(
    shouldFallbackToOpenAiImageGeneration("Quota exceeded 429"),
    true
  );
});

test("shouldFallbackToOpenAiImageGeneration ignores unrelated empty values", () => {
  assert.equal(shouldFallbackToOpenAiImageGeneration(""), false);
  assert.equal(shouldFallbackToOpenAiImageGeneration(null), false);
});
