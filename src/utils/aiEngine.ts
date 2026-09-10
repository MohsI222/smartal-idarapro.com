/**
 * Centralized AI Engine using Hugging Face Inference API
 * Free open-source alternative to Gemini API
 * Supports multiple modules: Logistics, HR, etc.
 */

export type AIModule = "logistics" | "hr" | "general";

export interface AIRequest {
  module: AIModule;
  prompt: string;
  locale?: string;
  maxLength?: number;
}

export interface AIResponse {
  text: string;
  success: boolean;
  error?: string;
}

/**
 * Convert oklch colors to hex for PDF export compatibility
 */
export function convertOklchToHex(color: string): string {
  // If already hex or rgb, return as-is
  if (color.startsWith('#') || color.startsWith('rgb')) {
    return color;
  }
  
  // Convert oklch to hex (simplified - use fallback colors)
  const colorMap: Record<string, string> = {
    'oklch(0.1 0 0)': '#1a1a1a',
    'oklch(0.2 0 0)': '#333333',
    'oklch(0.3 0 0)': '#4d4d4d',
    'oklch(0.4 0 0)': '#666666',
    'oklch(0.5 0 0)': '#808080',
    'oklch(0.6 0 0)': '#999999',
    'oklch(0.7 0 0)': '#b3b3b3',
    'oklch(0.8 0 0)': '#cccccc',
    'oklch(0.9 0 0)': '#e6e6e6',
    'oklch(1 0 0)': '#ffffff',
  };
  
  return colorMap[color] || '#000000';
}

/**
 * Force hex colors on an element for PDF export
 */
export function forceHexColors(element: HTMLElement): void {
  const computedStyle = window.getComputedStyle(element);
  
  // Convert background color
  const bgColor = computedStyle.backgroundColor;
  if (bgColor.includes('oklch')) {
    element.style.backgroundColor = convertOklchToHex(bgColor);
  }
  
  // Convert text color
  const textColor = computedStyle.color;
  if (textColor.includes('oklch')) {
    element.style.color = convertOklchToHex(textColor);
  }
  
  // Recursively process children
  Array.from(element.children).forEach(child => {
    if (child instanceof HTMLElement) {
      forceHexColors(child);
    }
  });
}

/**
 * Generate AI text using Hugging Face Inference API
 * Uses free tier with meta-llama/Meta-Llama-3-8B-Instruct model
 */
export async function generateAI(request: AIRequest): Promise<AIResponse> {
  const apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    console.warn("No Hugging Face API key found");
    return {
      text: "",
      success: false,
      error: "No API key configured"
    };
  }

  try {
    // Build module-specific prompt
    const systemPrompt = getSystemPrompt(request.module, request.locale);
    const fullPrompt = `${systemPrompt}\n\n${request.prompt}`;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          inputs: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n${fullPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
          parameters: {
            max_new_tokens: request.maxLength || 500,
            temperature: 0.7,
            top_p: 0.95,
            return_full_text: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Hugging Face API error:", errorText);
      
      // Try fallback model
      return await generateAIFallback(request);
    }

    const result = await response.json();
    const generated = result[0]?.generated_text || "";
    
    // Clean up response
    const cleanText = generated
      .replace(/<\|begin_of_text\|>/g, "")
      .replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/g, "")
      .replace(/<\|eot_id\|>/g, "")
      .trim();

    if (!cleanText) {
      throw new Error("Empty response");
    }

    return {
      text: cleanText,
      success: true,
    };
  } catch (error) {
    console.error("AI generation error:", error);
    
    // Try fallback
    return await generateAIFallback(request);
  }
}

/**
 * Fallback to Mistral model if Llama fails
 */
async function generateAIFallback(request: AIRequest): Promise<AIResponse> {
  const apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    return {
      text: "",
      success: false,
      error: "No API key configured"
    };
  }

  try {
    const systemPrompt = getSystemPrompt(request.module, request.locale);
    const fullPrompt = `${systemPrompt}\n\n${request.prompt}`;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          inputs: `<s>[INST] ${fullPrompt} [/INST]`,
          parameters: {
            max_new_tokens: request.maxLength || 500,
            temperature: 0.7,
            top_p: 0.95,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Fallback API also failed");
    }

    const result = await response.json();
    const generated = result[0]?.generated_text || "";
    
    const cleanText = generated
      .replace(/<s>.*?<\/s>/g, "")
      .replace(/\[INST\].*?\[\/INST\]/g, "")
      .trim();

    return {
      text: cleanText,
      success: true,
    };
  } catch (error) {
    console.error("Fallback AI generation error:", error);
    return {
      text: "",
      success: false,
      error: "All AI services failed"
    };
  }
}

/**
 * Get system prompt based on module context
 */
function getSystemPrompt(module: AIModule, locale: string = "en"): string {
  const localeName = locale === "ar-MA" ? "Arabic (Moroccan)" : 
                     locale === "fr" ? "French" :
                     locale === "es" ? "Spanish" : "English";

  switch (module) {
    case "logistics":
      return `You are a logistics and inventory expert. Generate professional stock status reports, routing notes, and structural analysis in ${localeName}. Be concise, clear, and actionable. Return only the relevant text without commentary.`;
    
    case "hr":
      return `You are an HR and administrative professional. Generate formal company letters, external notifications, and official administrative texts in ${localeName}. Use professional business language. Return only the document text without commentary.`;
    
    default:
      return `You are a helpful AI assistant. Generate professional text in ${localeName}. Be clear, concise, and helpful. Return only the generated text without commentary.`;
  }
}
