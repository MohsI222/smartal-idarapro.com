import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";

puppeteer.use(StealthPlugin());

interface RadarConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  checkInterval?: number;
  enabled?: boolean;
}

interface SlotDetection {
  centerId: string;
  centerName: string;
  url: string;
  detectedAt: Date;
  status: "open" | "closed";
}

class VisaRadarService {
  private browser: any = null;
  private page: any = null;
  private checkInterval: number = 1000; // 1 second
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private config: RadarConfig;
  private lastCheckTime: Date | null = null;
  private detections: SlotDetection[] = [];
  private onSlotDetectedCallbacks: ((detection: SlotDetection) => void)[] = [];

  constructor(config: RadarConfig = {}) {
    this.config = {
      telegramBotToken: config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: config.telegramChatId || process.env.TELEGRAM_CHAT_ID,
      checkInterval: config.checkInterval || 1000,
      enabled: config.enabled !== false,
    };
  }

  async initialize(): Promise<void> {
    if (this.browser) return;

    console.log("🚀 Initializing Visa Radar Service with Puppeteer...");
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set viewport and user agent to avoid detection
    await this.page.setViewport({ width: 1280, height: 800 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers to look like a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    console.log("✅ Visa Radar Service initialized successfully");
  }

  async checkSpainVisaSlots(): Promise<{ available: boolean; detectedAt: Date }> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      const url = 'https://spain.blsspainvisa.com/morocco/index.php';
      console.log(`📡 Checking Spain visa slots at ${new Date().toISOString()}...`);
      
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for page to load completely
      await this.page.waitForTimeout(2000);

      const slotInfo = await this.page.evaluate(() => {
        const body = document.body.innerText;
        const hasNoSlots = body.includes("No Slots Available") || 
                          body.includes("لا تتوفر مواعيد") ||
                          body.includes("No appointments available") ||
                          body.includes("Aucun rendez-vous disponible");
        
        // Check for calendar or appointment booking elements
        const hasCalendar = document.querySelector('.calendar') || 
                           document.querySelector('[class*="calendar"]') ||
                           document.querySelector('[class*="appointment"]') ||
                           document.querySelector('input[type="date"]');
        
        // Check for slot availability indicators
        const hasSlotIndicators = document.querySelector('[class*="slot"]') ||
                                  document.querySelector('[class*="available"]') ||
                                  document.querySelector('.available-date');

        return {
          hasNoSlots,
          hasCalendar: !!hasCalendar,
          hasSlotIndicators: !!hasSlotIndicators,
          bodyText: body.substring(0, 500)
        };
      });

      const available = !slotInfo.hasNoSlots || slotInfo.hasCalendar || slotInfo.hasSlotIndicators;
      this.lastCheckTime = new Date();

      console.log(`📊 Slot check result: ${available ? "AVAILABLE" : "NOT AVAILABLE"}`);

      if (available) {
        const detection: SlotDetection = {
          centerId: "spain-rabat",
          centerName: "Spain - Rabat Consulate",
          url,
          detectedAt: new Date(),
          status: "open"
        };
        
        this.detections.push(detection);
        this.notifySlotDetected(detection);
      }

      return { available, detectedAt: this.lastCheckTime };
    } catch (error) {
      console.error("❌ Error checking visa slots:", error);
      throw error;
    }
  }

  async checkMultipleCenters(centerUrls: { id: string; name: string; url: string }[]): Promise<SlotDetection[]> {
    if (!this.page) {
      await this.initialize();
    }

    const results: SlotDetection[] = [];

    for (const center of centerUrls) {
      try {
        console.log(`📡 Checking ${center.name}...`);
        
        await this.page.goto(center.url, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });

        await this.page.waitForTimeout(1500);

        const slotInfo = await this.page.evaluate(() => {
          const body = document.body.innerText;
          const hasNoSlots = body.includes("No Slots Available") || 
                            body.includes("لا تتوفر مواعيد") ||
                            body.includes("No appointments available");
          
          const hasCalendar = document.querySelector('.calendar') || 
                             document.querySelector('[class*="calendar"]') ||
                             document.querySelector('input[type="date"]');

          return {
            hasNoSlots,
            hasCalendar: !!hasCalendar,
            bodyText: body.substring(0, 300)
          };
        });

        const available = !slotInfo.hasNoSlots || slotInfo.hasCalendar;

        if (available) {
          const detection: SlotDetection = {
            centerId: center.id,
            centerName: center.name,
            url: center.url,
            detectedAt: new Date(),
            status: "open"
          };
          
          results.push(detection);
          this.detections.push(detection);
          this.notifySlotDetected(detection);
        }

        console.log(`✅ ${center.name}: ${available ? "AVAILABLE" : "NOT AVAILABLE"}`);
      } catch (error) {
        console.error(`❌ Error checking ${center.name}:`, error);
      }
    }

    this.lastCheckTime = new Date();
    return results;
  }

  private async notifyTelegram(message: string): Promise<void> {
    if (!this.config.telegramBotToken || !this.config.telegramChatId) {
      console.log("⚠️ Telegram credentials not configured");
      return;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`,
        {
          chat_id: this.config.telegramChatId,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true
        },
        { timeout: 10000 }
      );
      console.log("📨 Telegram notification sent successfully");
    } catch (error) {
      console.error("❌ Failed to send Telegram notification:", error);
    }
  }

  private notifySlotDetected(detection: SlotDetection): void {
    console.log(`🚨🚨🚨 SLOT DETECTED: ${detection.centerName}`);
    
    // Send Telegram notification
    const message = `🚨 *عاجل: رادار المواعيد كشف موعداً مفتوحاً الآن!*

📍 **المركز:** ${detection.centerName}
⏰ **التوقيت:** ${detection.detectedAt.toLocaleString('ar-MA')}
🔗 **احجز الآن:** ${detection.url}

⚡ *افتح الرابط فوراً للحجز قبل أن يغلق!*`;

    void this.notifyTelegram(message);

    // Call registered callbacks
    this.onSlotDetectedCallbacks.forEach(callback => {
      try {
        callback(detection);
      } catch (error) {
        console.error("Error in slot detection callback:", error);
      }
    });
  }

  onSlotDetected(callback: (detection: SlotDetection) => void): void {
    this.onSlotDetectedCallbacks.push(callback);
  }

  async startRadar(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ Radar is already running");
      return;
    }

    if (!this.config.enabled) {
      console.log("⚠️ Radar is disabled in configuration");
      return;
    }

    await this.initialize();
    this.isRunning = true;

    console.log(`🤖 Starting Visa Radar with ${this.checkInterval}ms interval...`);

    this.intervalId = setInterval(async () => {
      try {
        await this.checkSpainVisaSlots();
      } catch (error) {
        console.error("⚠️ Error in radar check cycle:", error);
      }
    }, this.checkInterval);
  }

  async startRadarForCenters(centerUrls: { id: string; name: string; url: string }[]): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ Radar is already running");
      return;
    }

    if (!this.config.enabled) {
      console.log("⚠️ Radar is disabled in configuration");
      return;
    }

    await this.initialize();
    this.isRunning = true;

    console.log(`🤖 Starting Multi-Center Visa Radar for ${centerUrls.length} centers...`);

    this.intervalId = setInterval(async () => {
      try {
        await this.checkMultipleCenters(centerUrls);
      } catch (error) {
        console.error("⚠️ Error in multi-center radar check cycle:", error);
      }
    }, this.checkInterval);
  }

  stopRadar(): void {
    if (!this.isRunning) {
      console.log("⚠️ Radar is not running");
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log("🛑 Visa Radar stopped");
  }

  async shutdown(): Promise<void> {
    this.stopRadar();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    
    console.log("🔌 Visa Radar Service shut down");
  }

  getStatus(): {
    isRunning: boolean;
    lastCheckTime: Date | null;
    detections: SlotDetection[];
    checkInterval: number;
    config: RadarConfig;
  } {
    return {
      isRunning: this.isRunning,
      lastCheckTime: this.lastCheckTime,
      detections: this.detections.slice(-20), // Last 20 detections
      checkInterval: this.checkInterval,
      config: this.config
    };
  }

  updateConfig(newConfig: Partial<RadarConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.checkInterval && this.isRunning) {
      console.log(`🔄 Updating check interval to ${newConfig.checkInterval}ms`);
      this.stopRadar();
      void this.startRadar();
    }
  }

  clearDetections(): void {
    this.detections = [];
  }

  async attemptAutoBooking(centerUrl: string, profile: { fullName: string; passportNumber: string; phone: string; email: string }): Promise<{ success: boolean; message: string }> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      console.log("🎯 Attempting automatic booking...");
      
      await this.page.goto(centerUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await this.page.waitForTimeout(2000);

      // Look for available appointment slots and click on one
      const slotClicked = await this.page.evaluate(() => {
        const slots = document.querySelectorAll('[class*="available"], [class*="slot"], .calendar-day:not(.disabled)');
        if (slots.length > 0) {
          (slots[0] as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (!slotClicked) {
        return { success: false, message: "لم يتم العثور على مواعيد متاحة للحجز" };
      }

      await this.page.waitForTimeout(1500);

      // Fill in the booking form (this would need to be customized per embassy)
      const formFilled = await this.page.evaluate((data: { fullName: string; passportNumber: string; phone: string; email: string }) => {
        const nameInput = document.querySelector('input[name*="name"], input[id*="name"]') as HTMLInputElement;
        const passportInput = document.querySelector('input[name*="passport"], input[id*="passport"]') as HTMLInputElement;
        const phoneInput = document.querySelector('input[name*="phone"], input[id*="phone"], input[name*="mobile"]') as HTMLInputElement;
        const emailInput = document.querySelector('input[name*="email"], input[id*="email"]') as HTMLInputElement;

        if (nameInput) nameInput.value = data.fullName;
        if (passportInput) passportInput.value = data.passportNumber;
        if (phoneInput) phoneInput.value = data.phone;
        if (emailInput) emailInput.value = data.email;

        return !!(nameInput || passportInput || phoneInput || emailInput);
      }, profile);

      if (!formFilled) {
        return { success: false, message: "لم يتم العثور على نموذج الحجز" };
      }

      await this.page.waitForTimeout(1000);

      // Look for submit button
      const submitClicked = await this.page.evaluate(() => {
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], [class*="submit"], [class*="confirm"]') as HTMLElement;
        if (submitBtn) {
          submitBtn.click();
          return true;
        }
        return false;
      });

      if (submitClicked) {
        console.log("✅ Booking form submitted");
        return { success: true, message: "تم إرسال طلب الحجز تلقائياً" };
      }

      return { success: false, message: "لم يتم العثور على زر الإرسال" };
    } catch (error) {
      console.error("❌ Auto booking error:", error);
      return { success: false, message: `خطأ في الحجز التلقائي: ${String(error)}` };
    }
  }
}

// Singleton instance
let radarService: VisaRadarService | null = null;

export function getVisaRadarService(config?: RadarConfig): VisaRadarService {
  if (!radarService) {
    radarService = new VisaRadarService(config);
  }
  return radarService;
}

export { VisaRadarService, type RadarConfig, type SlotDetection };
