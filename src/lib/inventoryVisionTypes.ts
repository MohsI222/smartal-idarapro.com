/** Structured receipt lines from GPT-4o vision or OCR fallback */
export type VisionReceiptItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
};
