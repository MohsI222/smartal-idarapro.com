/**
 * Visa Radar Pro - Production-Grade Real-Time Monitoring System
 * Features: Stealth scraping, user-agent rotation, smart retry, persistent alerts
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { getEnabledCenters, type VisaCenter } from "./visaRadarConfig.js";

puppeteer.use(StealthPlugin());

interface RadarProConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  whatsappEnabled?: boolean;
  whatsappNumber?: string;
  baseCheckInterval?: number;
  extremeModeInterval?: number;
  enabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

interface SlotDetection {
  centerId: string;
  country: string;
  countryAr: string;
  city: string;
  cityAr: string;
  provider: string;
  url: string;
  detectedAt: Date;
  status: "open" | "closed";
}

interface RadarLog {
  timestamp: Date;
  centerId: string;
  centerName: string;
  action: string;
  status: string;
  details?: string;
}

// User-Agent rotation pool
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

class VisaRadarPro {
  private browser: any = null;
  private page: any = null;
  private checkInterval: number = 1000;
  private extremeModeInterval: number = 500;
  private isRunning: boolean = false;
  private isExtremeMode: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private config: RadarProConfig;
  private lastCheckTime: Date | null = null;
  private detections: SlotDetection[] = [];
  private logs: RadarLog[] = [];
  private onSlotDetectedCallbacks: ((detection: SlotDetection) => void)[] = [];
  private userAgentIndex: number = 0;
  private consecutiveFailures: Map<string, number> = new Map();
  private historicalPatterns: Map<string, number[]> = new Map(); // Center ID -> Array of hour patterns

  constructor(config: RadarProConfig = {}) {
    this.config = {
      telegramBotToken: config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: config.telegramChatId || process.env.TELEGRAM_CHAT_ID,
      whatsappEnabled: config.whatsappEnabled || false,
      whatsappNumber: config.whatsappNumber || "",
      baseCheckInterval: config.baseCheckInterval || 1000,
      extremeModeInterval: config.extremeModeInterval || 500,
      enabled: config.enabled !== false,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 500,
    };
  }

  private getRandomUserAgent(): string {
    this.userAgentIndex = (this.userAgentIndex + 1) % USER_AGENTS.length;
    return USER_AGENTS[this.userAgentIndex];
  }

  private log(centerId: string, centerName: string, action: string, status: string, details?: string): void {
    const logEntry: RadarLog = {
      timestamp: new Date(),
      centerId,
      centerName,
      action,
      status,
      details,
    };
    this.logs.push(logEntry);
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    // Console output with colors
    const timestamp = logEntry.timestamp.toISOString();
    const statusEmoji = status === "success" ? "✅" : status === "error" ? "❌" : status === "warning" ? "⚠️" : "ℹ️";
    console.log(`[${timestamp}] ${statusEmoji} ${centerName} - ${action}: ${status}${details ? ` (${details})` : ""}`);
  }

  async initialize(): Promise<void> {
    if (this.browser) return;

    console.log("🚀 Initializing Visa Radar Pro with Puppeteer Stealth...");
    
    // Try to use system Chrome if available, otherwise use puppeteer's bundled Chrome
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
    ];

    let executablePath: string | undefined;
    for (const path of chromePaths) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(path)) {
          executablePath = path;
          console.log(`📱 Using system Chrome: ${path}`);
          break;
        }
      } catch {
        continue;
      }
    }

    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
      ]
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    try {
      this.browser = await puppeteer.launch(launchOptions);
    } catch (error) {
      console.error("❌ Failed to launch browser:", error);
      throw new Error("Could not launch browser. Please ensure Chrome/Chromium is installed.");
    }

    this.page = await this.browser.newPage();
    
    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    
    // Set random user agent
    await this.page.setUserAgent(this.getRandomUserAgent());
    
    // Set extra headers to look like a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    });

    // Set permissions
    await this.page.setGeolocation({ latitude: 33.5731, longitude: -7.5898 }); // Morocco coordinates
    
    console.log("✅ Visa Radar Pro initialized successfully");
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async smartRetry<T>(
    operation: () => Promise<T>,
    center: VisaCenter,
    operationName: string
  ): Promise<T> {
    const maxRetries = this.config.maxRetries || 3;
    const retryDelay = this.config.retryDelay || 500;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        this.consecutiveFailures.set(center.id, 0); // Reset failure counter on success
        return result;
      } catch (error) {
        const failureCount = (this.consecutiveFailures.get(center.id) || 0) + 1;
        this.consecutiveFailures.set(center.id, failureCount);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log(center.id, `${center.country} - ${center.city}`, operationName, "error", `Attempt ${attempt}/${maxRetries}: ${errorMessage}`);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff with jitter
        const backoffDelay = retryDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
        console.log(`⏳ Retrying ${center.city} in ${backoffDelay.toFixed(0)}ms...`);
        await this.sleep(backoffDelay);
        
        // Rotate user agent on retry
        if (this.page) {
          await this.page.setUserAgent(this.getRandomUserAgent());
        }
      }
    }
    
    throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`);
  }

  async checkCenterSlots(center: VisaCenter): Promise<{ available: boolean; detectedAt: Date }> {
    if (!this.page) {
      await this.initialize();
    }

    const centerName = `${center.country} - ${center.city} (${center.provider})`;
    
    return this.smartRetry(async () => {
      console.log(`📡 Checking ${centerName} at ${new Date().toISOString()}...`);
      
      await this.page.goto(center.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for page to load completely
      await this.sleep(2000);

      const slotInfo = await this.page.evaluate(() => {
        const body = document.body.innerText.toLowerCase();
        
        // Check for various "no slots" indicators
        const noSlotsIndicators = [
          "no slots available",
          "لا تتوفر مواعيد",
          "no appointments available",
          "aucun rendez-vous disponible",
          "sin citas disponibles",
          "keine termine verfügbar",
          "nessun appuntamento disponibile"
        ];
        
        const hasNoSlots = noSlotsIndicators.some(indicator => body.includes(indicator));
        
        // Check for calendar or appointment booking elements
        const hasCalendar = !!(
          document.querySelector('.calendar') || 
          document.querySelector('[class*="calendar"]') ||
          document.querySelector('[class*="appointment"]') ||
          document.querySelector('input[type="date"]') ||
          document.querySelector('[class*="slot"]') ||
          document.querySelector('[class*="available"]') ||
          document.querySelector('.available-date') ||
          document.querySelector('[class*="booking"]')
        );
        
        // Check for specific slot availability indicators
        const hasSlotIndicators = !!(
          document.querySelector('[class*="slot"]') ||
          document.querySelector('[class*="available"]') ||
          document.querySelector('.available-date') ||
          document.querySelector('[class*="time-slot"]')
        );

        return {
          hasNoSlots,
          hasCalendar,
          hasSlotIndicators,
          bodyText: document.body.innerText.substring(0, 500)
        };
      });

      const available = !slotInfo.hasNoSlots || slotInfo.hasCalendar || slotInfo.hasSlotIndicators;
      this.lastCheckTime = new Date();

      if (available) {
        this.log(center.id, centerName, "SLOT DETECTED", "success", "Slots are available!");
        
        const detection: SlotDetection = {
          centerId: center.id,
          country: center.country,
          countryAr: center.countryAr,
          city: center.city,
          cityAr: center.cityAr,
          provider: center.provider,
          url: center.url,
          detectedAt: new Date(),
          status: "open"
        };
        
        this.detections.push(detection);
        this.recordHistoricalPattern(center.id);
        this.notifySlotDetected(detection);
      } else {
        this.log(center.id, centerName, "Check completed", "success", "No slots available");
      }

      console.log(`📊 ${centerName}: ${available ? "✅ AVAILABLE" : "❌ NOT AVAILABLE"}`);

      return { available, detectedAt: this.lastCheckTime };
    }, center, "check slots");
  }

  private recordHistoricalPattern(centerId: string): void {
    const hour = new Date().getHours();
    const patterns = this.historicalPatterns.get(centerId) || [];
    patterns.push(hour);
    
    // Keep only last 100 detections
    if (patterns.length > 100) {
      patterns.shift();
    }
    
    this.historicalPatterns.set(centerId, patterns);
  }

  private shouldEnableExtremeMode(): boolean {
    const currentHour = new Date().getHours();
    
    // Check if current time matches historical patterns
    for (const [centerId, patterns] of this.historicalPatterns.entries()) {
      if (patterns.includes(currentHour)) {
        console.log(`🔥 Extreme Mode: Historical pattern detected for center ${centerId} at hour ${currentHour}`);
        return true;
      }
    }
    
    // Also enable during peak hours (8 AM - 12 PM, 2 PM - 6 PM)
    if ((currentHour >= 8 && currentHour <= 12) || (currentHour >= 14 && currentHour <= 18)) {
      return true;
    }
    
    return false;
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

  private async notifyWhatsApp(message: string): Promise<void> {
    if (!this.config.whatsappEnabled || !this.config.whatsappNumber) {
      console.log("⚠️ WhatsApp not configured");
      return;
    }

    try {
      // Using a simple WhatsApp API call (can be replaced with Baileys or other gateway)
      const whatsappUrl = `https://wa.me/${this.config.whatsappNumber}?text=${encodeURIComponent(message)}`;
      console.log(`📱 WhatsApp notification: ${whatsappUrl}`);
      
      // For production, integrate with Baileys or a WhatsApp Business API
      // This is a placeholder for the actual implementation
    } catch (error) {
      console.error("❌ Failed to send WhatsApp notification:", error);
    }
  }

  private notifySlotDetected(detection: SlotDetection): void {
    const centerName = `${detection.countryAr} - ${detection.cityAr} (${detection.provider})`;
    console.log(`🚨🚨🚨 SLOT DETECTED: ${centerName}`);
    
    // Send Telegram notification
    const telegramMessage = `🚨 *عاجل: رادار المواعيد كشف موعداً مفتوحاً الآن!*

📍 **المركز:** ${centerName}
🏳️ **الدولة:** ${detection.countryAr}
🏙️ **المدينة:** ${detection.cityAr}
🏢 **المزود:** ${detection.provider}
⏰ **التوقيت:** ${detection.detectedAt.toLocaleString('ar-MA')}
🔗 **احجز الآن:** ${detection.url}

⚡ *افتح الرابط فوراً للحجز قبل أن يغلق!*`;

    void this.notifyTelegram(telegramMessage);

    // Send WhatsApp notification
    const whatsappMessage = `🚨 عاجل! موعد تأشيرة متاح في ${centerName}\n\nاحجز الآن: ${detection.url}\nالتوقيت: ${detection.detectedAt.toLocaleString('ar-MA')}`;
    void this.notifyWhatsApp(whatsappMessage);

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

    console.log(`🤖 Starting Visa Radar Pro with ${this.checkInterval}ms interval...`);

    const runCheckCycle = async () => {
      if (!this.isRunning) return;

      try {
        // Check if we should enable extreme mode
        const shouldUseExtremeMode = this.shouldEnableExtremeMode();
        
        if (shouldUseExtremeMode && !this.isExtremeMode) {
          this.isExtremeMode = true;
          console.log(`🔥 EXTREME MODE ACTIVATED: Checking every ${this.extremeModeInterval}ms`);
        } else if (!shouldUseExtremeMode && this.isExtremeMode) {
          this.isExtremeMode = false;
          console.log(`❄️ Normal Mode: Checking every ${this.checkInterval}ms`);
        }

        const centers = getEnabledCenters();

        // Check all enabled centers
        for (const center of centers) {
          try {
            await this.checkCenterSlots(center);
          } catch (error) {
            console.error(`Error checking ${center.city}:`, error);
          }
          
          // Small delay between centers to avoid overwhelming the system
          await this.sleep(100);
        }

      } catch (error) {
        console.error("⚠️ Error in radar check cycle:", error);
      }

      // Schedule next check
      if (this.isRunning) {
        const currentInterval = this.isExtremeMode ? this.extremeModeInterval : this.checkInterval;
        this.intervalId = setTimeout(runCheckCycle, currentInterval);
      }
    };

    // Start the check cycle
    void runCheckCycle();
  }

  stopRadar(): void {
    if (!this.isRunning) {
      console.log("⚠️ Radar is not running");
      return;
    }

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.isExtremeMode = false;
    console.log("🛑 Visa Radar Pro stopped");
  }

  async shutdown(): Promise<void> {
    this.stopRadar();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    
    console.log("🔌 Visa Radar Pro shut down");
  }

  getStatus(): {
    isRunning: boolean;
    isExtremeMode: boolean;
    lastCheckTime: Date | null;
    detections: SlotDetection[];
    logs: RadarLog[];
    checkInterval: number;
    extremeModeInterval: number;
    config: RadarProConfig;
    consecutiveFailures: Record<string, number>;
  } {
    const failuresMap: Record<string, number> = {};
    this.consecutiveFailures.forEach((count, centerId) => {
      failuresMap[centerId] = count;
    });

    return {
      isRunning: this.isRunning,
      isExtremeMode: this.isExtremeMode,
      lastCheckTime: this.lastCheckTime,
      detections: this.detections.slice(-20),
      logs: this.logs.slice(-50),
      checkInterval: this.checkInterval,
      extremeModeInterval: this.extremeModeInterval,
      config: this.config,
      consecutiveFailures: failuresMap,
    };
  }

  updateConfig(newConfig: Partial<RadarProConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.baseCheckInterval) {
      this.checkInterval = newConfig.baseCheckInterval;
    }
    if (newConfig.extremeModeInterval) {
      this.extremeModeInterval = newConfig.extremeModeInterval;
    }
    
    console.log("🔄 Radar configuration updated");
  }

  clearDetections(): void {
    this.detections = [];
  }

  clearLogs(): void {
    this.logs = [];
  }

  getHistoricalPatterns(): Record<string, number[]> {
    const patternsMap: Record<string, number[]> = {};
    this.historicalPatterns.forEach((patterns, centerId) => {
      patternsMap[centerId] = patterns;
    });
    return patternsMap;
  }
}

// Singleton instance
let radarProService: VisaRadarPro | null = null;

export function getVisaRadarProService(config?: RadarProConfig): VisaRadarPro {
  if (!radarProService) {
    radarProService = new VisaRadarPro(config);
  }
  return radarProService;
}

export { VisaRadarPro, type RadarProConfig, type SlotDetection, type RadarLog };
