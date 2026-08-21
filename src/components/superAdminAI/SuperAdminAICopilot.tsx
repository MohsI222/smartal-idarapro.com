import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { PUBLIC_SUPER_ADMIN_EMAIL } from "@/constants/publicSuperAdmin";
import { Bot, X, ChevronUp, ChevronDown, Mic, Volume2, Shield, AlertTriangle, Code, Zap, Settings, Copy, Check } from "lucide-react";

interface ErrorLog {
  id: string;
  timestamp: Date;
  message: string;
  file?: string;
  line?: number;
  stack?: string;
  type: "error" | "warning" | "security";
  arabicExplanation: string;
  fixPrompt: string;
  fixedCode?: string;
  devonPrompt?: string;
}

interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: "rls_violation" | "missing_rls" | "data_exposure" | "permission_issue";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  table?: string;
  patchSteps: string[];
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const PROJECT_CONTEXT = `
# Smart Al-Idara Pro - Project Context Knowledge Base

## Inventory & Sales System (المخزون والمبيعات)

### Key Files:
- **InventoryPosModule.tsx** (src/pages/modules/InventoryPosModule.tsx):
  - Main inventory and POS module
  - Key functions:
    - handleInventoryImportFile (line 2039): Handles CSV/Excel file imports
    - upsertImportedProducts (line 1872): Batch inserts/updates products
    - importInventoryFromText (line 2005): Imports from plain text/OCR
    - parseInventoryImportRows: Parses spreadsheet rows
    - submitQuickDraft (line 1081): Processes POS sales
    - handleSaveProduct (line 1250): Saves/updates products
  - Features: POS, barcode scanning, CSV/Excel import, OCR, stock management
  - Uses XLSX library for spreadsheet parsing
  - Uses jsPDF for PDF exports

- **PermissionsContext.tsx** (src/context/PermissionsContext.tsx):
  - Manages user permissions for inventory, HR, delivery, etc.
  - Key functions: fetchPermissions, hasPermission, isAdmin
  - Super Admin: lahcenm534@gmail.com has full access

- **AuthContext.tsx** (src/context/AuthContext.tsx):
  - Authentication system with Supabase
  - Provides user object with id, email, role

### Database Schema (Supabase):

#### inventory_products Table:
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- name: text (product name)
- sku: text (stock keeping unit)
- barcode: text
- retail_type: text (grocery, pharmacy, supermarket, etc.)
- pieces_per_carton: integer
- unit_price: numeric
- stock_pieces: integer
- unit_kind: text (piece, box, bag, kg)
- cost_price: numeric
- expiry_date: date
- low_stock_alert: integer
- created_at: timestamp
- updated_at: timestamp

#### shift_reports Table:
- id: UUID
- user_id: UUID
- shift_date: date
- shift_group: text (morning, evening)
- start_time: timestamp
- end_time: timestamp
- hours_worked: numeric
- tasks_completed: jsonb
- created_at: timestamp

#### customers Table:
- id: UUID
- user_id: UUID
- name: text
- phone: text
- email: text
- address: text
- created_at: timestamp

#### hr_employees Table:
- id: UUID
- user_id: UUID
- full_name: text
- employee_id: text
- role: text
- department: text
- created_at: timestamp

#### permissions Table:
- id: UUID
- user_id: UUID
- employee_id: UUID
- can_access_inventory: boolean
- can_access_hr: boolean
- can_access_delivery: boolean
- can_access_transport_logistics: boolean
- can_access_wedding_invitations: boolean
- can_access_legal: boolean
- can_access_ai: boolean
- can_access_settings: boolean
- is_admin: boolean
- created_at: timestamp
- updated_at: timestamp

### RLS Policies:
- All tables have Row Level Security enabled
- Standard policy: auth.uid()::text = user_id::text OR user_id IS NULL
- Users can only access their own data
- Admins have override permissions via is_admin flag
- Super Admin (lahcenm534@gmail.com) has full access override
- RLS error code 42501 indicates permission denied

### Common Import Issues:
1. **Type Conversion**: Prices and quantities must be converted to Number/parseInt
2. **user_id Missing**: All inserts must include user_id from auth session
3. **Empty Fields**: Required fields (name, sku) cannot be empty
4. **Batch Size**: Large imports should be batched to avoid timeouts
5. **Encoding**: CSV files must use UTF-8 encoding

### Tech Stack:
- React 19 with TypeScript
- Supabase for database and auth
- Tailwind CSS for styling
- Vite for build tool
- Express backend server
- XLSX library for spreadsheet parsing
- jsPDF for PDF generation

### Security Notes:
- RLS code 42501 indicates permission denied
- Missing RLS on tables is a critical security issue
- user_id filtering is required for all queries
- Super Admin override bypasses RLS for lahcenm534@gmail.com
- All inventory operations must include user_id from auth session
`;

export function SuperAdminAICopilot() {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "errors" | "security" | "features">("chat");
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  
  // Counter for unique IDs to prevent duplicate keys
  const idCounterRef = useRef(0);
  const generateUniqueId = useCallback(() => {
    idCounterRef.current += 1;
    return `${Date.now()}-${idCounterRef.current}`;
  }, []);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check if current user is Super Admin
  const isSuperAdmin = user?.email?.toLowerCase() === PUBLIC_SUPER_ADMIN_EMAIL;

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation]);

  // Load errors from localStorage on mount
  useEffect(() => {
    if (!isSuperAdmin) return;
    
    try {
      const storedErrors = JSON.parse(localStorage.getItem('superadmin_errors') || '[]');
      if (storedErrors.length > 0) {
        setErrorLogs(storedErrors.map((err: any) => ({
          ...err,
          timestamp: new Date(err.timestamp)
        })));
        
        // Show the most recent error immediately in chat
        const latestError = storedErrors[0];
        if (latestError && conversation.length === 0) {
          const aiResponse: ConversationMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `📍 مكان المشكلة: ${latestError.file || "غير معروف"}:${latestError.line || "?"}

🔍 سبب المشكلة:
${latestError.arabicExplanation || latestError.message}

🛠️ الكود المصحح:
\`\`\`
${latestError.fixedCode || "// راجع الخطأ وأضف التحقق المناسب"}
\`\`\`

📋 برومبت التنفيذ لـ Devon:
\`\`\`
${latestError.devonPrompt || latestError.fixPrompt}
\`\`\`

📋 انسخ البرومبت لـ Devon من تبويب الأخطاء`,
            timestamp: new Date(),
          };
          setConversation([aiResponse]);
        }
      }
    } catch (err) {
      console.error('Error loading from localStorage:', err);
    }
  }, [isSuperAdmin]);

  // Error Interception System
  useEffect(() => {
    if (!isSuperAdmin) return;

    const handleError = (event: ErrorEvent) => {
      const fixedCode = generateFixedCode(event.message, event.filename, event.lineno);
      const errorLog: ErrorLog = {
        id: Date.now().toString(),
        timestamp: new Date(),
        message: event.message,
        file: event.filename,
        line: event.lineno,
        stack: event.error?.stack,
        type: "error",
        arabicExplanation: generateArabicExplanation(event.message, event.filename, event.lineno),
        fixPrompt: generateFixPrompt(event.message, event.filename, event.lineno, event.error?.stack),
        fixedCode,
        devonPrompt: generateDevonPrompt(event.message, event.filename, event.lineno, event.error?.stack, fixedCode),
      };
      setErrorLogs(prev => [errorLog, ...prev].slice(0, 50));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const fixedCode = `// Fix: Add proper error handling for async operations
try {
  await asyncOperation();
} catch (error) {
  console.error('Async error:', error);
  // Handle error appropriately
}`;
      const errorLog: ErrorLog = {
        id: generateUniqueId(),
        timestamp: new Date(),
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        type: "error",
        arabicExplanation: "خطأ في Promise غير معالج - قد يكون هناك مشكلة في طلب غير متزامن",
        fixPrompt: generateFixPrompt(String(event.reason), undefined, undefined, event.reason?.stack),
        fixedCode,
        devonPrompt: generateDevonPrompt(String(event.reason), undefined, undefined, event.reason?.stack, fixedCode),
      };
      setErrorLogs(prev => [errorLog, ...prev].slice(0, 50));
    };

    const handleConsoleError = (message: string) => {
      const fixedCode = `// Fix: Review and address the console warning
// Message: ${message}
// Add proper error handling or fix the underlying issue`;
      const errorLog: ErrorLog = {
        id: Date.now().toString(),
        timestamp: new Date(),
        message: message,
        type: "warning",
        arabicExplanation: "تحذير من Console - قد يؤثر على أداء التطبيق",
        fixPrompt: `// Console Warning detected\n// Message: ${message}\n// Check the console for full details`,
        fixedCode,
        devonPrompt: generateDevonPrompt(message, undefined, undefined, undefined, fixedCode),
      };
      setErrorLogs(prev => [errorLog, ...prev].slice(0, 50));
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    
    // Override console.error to capture errors
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Convert all args to strings for better error logging
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack}`;
        } else if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      handleConsoleError(message);
      originalConsoleError.apply(console, args);
    };

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      console.error = originalConsoleError;
    };
  }, [isSuperAdmin]);

  // Load errors from localStorage (from GlobalErrorBoundary)
  useEffect(() => {
    if (!isSuperAdmin) return;

    const loadStoredErrors = () => {
      const stored = localStorage.getItem("superadmin_errors");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const formatted = parsed.map((err: any) => {
            const fixedCode = generateFixedCode(err.message, undefined, undefined);
            return {
              id: err.id,
              timestamp: new Date(err.timestamp),
              message: err.message,
              stack: err.stack,
              type: "error" as const,
              arabicExplanation: generateArabicExplanation(err.message, undefined, undefined),
              fixPrompt: generateFixPrompt(err.message, undefined, undefined, err.stack),
              fixedCode,
              devonPrompt: generateDevonPrompt(err.message, undefined, undefined, err.stack, fixedCode),
            };
          });
          setErrorLogs(formatted);
          localStorage.removeItem("superadmin_errors");
        } catch (e) {
          console.error("Failed to parse stored errors:", e);
        }
      }
    };

    loadStoredErrors();
    
    // Poll for new errors every 2 seconds
    const interval = setInterval(loadStoredErrors, 2000);
    
    return () => clearInterval(interval);
  }, [isSuperAdmin]);

  // Security Monitoring for Supabase
  useEffect(() => {
    if (!isSuperAdmin) return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Clone response to read body without consuming it
      const clonedResponse = response.clone();
      
      try {
        const data = await clonedResponse.json();
        
        // Check for RLS violations (code 42501)
        if (data.error?.code === "42501") {
          const alert: SecurityAlert = {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: "rls_violation",
            severity: "high",
            message: "انتهاك سياسة أمان Row Level Security (RLS)",
            table: data.table,
            patchSteps: [
              "1. تحقق من سياسات RLS للجدول المعني",
              "2. تأكد من أن المستخدم لديه الصلاحية المطلوبة",
              "3. راجع علاقة user_id مع auth.uid()",
              "4. للسوبر أدمن: تأكد من تطبيق سياسات Super Admin RLS",
            ],
          };
          setSecurityAlerts(prev => [alert, ...prev].slice(0, 20));
        }
        
        // Check for missing data that might indicate RLS issues
        if (data.error?.message?.includes("permission denied")) {
          const alert: SecurityAlert = {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: "permission_issue",
            severity: "critical",
            message: "تم رفض الإذن - قد تكون هناك مشكلة في RLS",
            table: data.table,
            patchSteps: [
              "1. تحقق من أن الجدول لديه RLS مفعّل",
              "2. تأكد من وجود سياسات SELECT/INSERT/UPDATE/DELETE",
              "3. راجع شروط USING و WITH CHECK",
              "4. تحقق من أن user_id مطابق لـ auth.uid()",
              "5. للسوبر أدمن: تأكد من أن is_super_admin() function تعمل بشكل صحيح",
            ],
          };
          setSecurityAlerts(prev => [alert, ...prev].slice(0, 20));
        }

        // Check for 401 Unauthorized errors related to Supabase auth
        if (response.status === 401 && data.error?.message?.includes("JWT")) {
          const alert: SecurityAlert = {
            id: generateUniqueId(),
            timestamp: new Date(),
            type: "permission_issue",
            severity: "high",
            message: "خطأ في مصادقة Supabase (JWT)",
            table: data.table,
            patchSteps: [
              "1. تأكد من أن المستخدم مسجل الدخول عبر Supabase Auth",
              "2. تحقق من أن session صالح وغير منتهية",
              "3. للمكونات التي تستخدم auto_real_estate: تأكد من استخدام getSession()",
              "4. للسوبر أدمن: تأكد من أن Supabase session موجود قبل العمليات",
            ],
          };
          setSecurityAlerts(prev => [alert, ...prev].slice(0, 20));
        }

        // Ignore "No auth session found" warnings as they are handled by the components
        if (data.error?.message?.includes("No auth session found")) {
          // Don't create an alert for this - it's handled by the component
          return response;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isSuperAdmin]);

  // Speech-to-Text
  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("متصفحك لا يدعم التعرف على الصوت");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Text-to-Speech
  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      alert("متصفحك لا يدعم تحويل النص إلى صوت");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.9;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, []);

  // Copy fix prompt to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  // Generate Arabic explanation for errors
  const generateArabicExplanation = (message: string, file?: string, line?: number): string => {
    const location = file && line ? `في ${file.split('/').pop()}:${line}` : "";
    
    // Inventory import specific errors
    if (message.includes("import") || message.includes("استيراد")) {
      return `فشل استيراد المخزون ${location}. السبب المحتمل: عدم تحويل الأسعار والكميات لأرقام (Number/parseInt) أو غياب user_id الخاص بالجلسة مما يسبب رفض Supabase. تأكد من تحويل جميع الحقول الرقمية وإضافة user_id من auth.session.`;
    }
    
    if (message.includes("Cannot read properties")) {
      return `خطأ في قراءة خاصية غير موجودة ${location}. غالباً ما يحدث هذا عند محاولة الوصول إلى كائن null أو undefined.`;
    }
    if (message.includes("is not defined")) {
      return `متغير أو دالة غير معرّف ${location}. تحقق من تهيئة المتغير قبل استخدامه.`;
    }
    if (message.includes("NetworkError") || message.includes("Failed to fetch")) {
      return `خطأ في الشبكة ${location}. تحقق من اتصال الإنترنت أو أن الخادم الخلفي يعمل.`;
    }
    if (message.includes("permission")) {
      return `خطأ في الصلاحيات ${location}. قد تكون هناك مشكلة في سياسات RLS أو عدم وجود صلاحية كافية.`;
    }
    
    return `خطأ عام: ${message} ${location}`;
  };

  // Generate fix prompt for AI
  const generateFixPrompt = (message: string, file?: string, line?: number, stack?: string): string => {
    return `You are an expert developer fixing a bug in Smart Al-Idara Pro.

ERROR DETAILS:
- Message: ${message}
- File: ${file || "Unknown"}
- Line: ${line || "Unknown"}
- Stack: ${stack || "None"}

PROJECT CONTEXT:
${PROJECT_CONTEXT}

TASK:
1. Analyze this error in the context of the Smart Al-Idara Pro codebase
2. Identify the root cause
3. Provide a specific fix with exact code changes
4. Include the file path and line numbers to modify
5. Explain the fix in Arabic

Please provide the complete solution.`;
  };

  // Generate Devon-specific prompt for auto-implementation
  const generateDevonPrompt = (message: string, file?: string, line?: number, stack?: string, fixedCode?: string): string => {
    return `Fix this bug in Smart Al-Idara Pro:

Error: ${message}
File: ${file || "Unknown"}
Line: ${line || "Unknown"}

${fixedCode ? `Suggested Fix:\n${fixedCode}` : ''}

Stack: ${stack || "None"}

Apply the fix to the codebase.`;
  };

  // Generate fixed code example based on error type
  const generateFixedCode = (message: string, file?: string, line?: number): string => {
    // Inventory import specific errors
    if (message.includes("import") || message.includes("استيراد")) {
      return `// Fix: Ensure proper type conversion and user_id in InventoryPosModule.tsx
// In upsertImportedProducts function (line 1872):

const sanitizedItem = {
  name: item.name.trim(),
  sku: item.sku?.trim() || "",
  unit_price: Number(item.unit_price) || 0,  // Convert to number
  cost_price: Number(item.cost_price) || 0,   // Convert to number
  stock_pieces: Number(item.stock_pieces) || 1, // Convert to number
  pieces_per_carton: Number(item.pieces_per_carton) || 1,
  low_stock_alert: Number(item.low_stock_alert) || 10,
  retail_type: item.retail_type || 'retail',
  unit_kind: item.unit_kind || 'piece',
};

// Always include user_id from auth session
const authUserId = session?.user?.id || user?.id;
if (!authUserId) {
  console.error('No auth user ID available');
  return 0;
}

toInsert.push({ ...sanitizedItem, user_id: authUserId });`;
    }
    
    if (message.includes("Cannot read properties")) {
      return `// Fix: Add null check before accessing property
if (obj && obj.property) {
  // Safe to access
} else {
  // Handle null/undefined case
}`;
    }
    if (message.includes("is not defined")) {
      return `// Fix: Define the variable before use
const variableName = defaultValue;
// or check if exists
if (typeof variableName !== 'undefined') {
  // Use variable
}`;
    }
    if (message.includes("permission")) {
      return `// Fix: Add proper RLS policy or check permissions
// In Supabase SQL:
CREATE POLICY "Users can read own data"
  ON table_name FOR SELECT
  USING (auth.uid()::text = user_id);

// Or in code:
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId);`;
    }
    
    return `// Review the error and add appropriate null checks,
// error handling, or permission checks as needed.`;
  };

  // Handle user message
  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: ConversationMessage = {
      id: generateUniqueId(),
      role: "user",
      content: inputText,
      timestamp: new Date(),
    };

    setConversation(prev => [...prev, userMessage]);
    setInputText("");

    // Simulate AI response after 1 second
    setTimeout(() => {
      const aiResponse: ConversationMessage = {
        id: generateUniqueId(),
        role: "assistant",
        content: generateAIResponse(inputText),
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, aiResponse]);
    }, 1000);
  };

  // Generate AI response (mock implementation)
  const generateAIResponse = (userInput: string): string => {
    const lowerInput = userInput.toLowerCase();
    
    // Inventory import specific handling
    if (lowerInput.includes("استيراد") || lowerInput.includes("import") || lowerInput.includes("csv") || lowerInput.includes("excel")) {
      return `📍 مكان المشكلة: InventoryPosModule.tsx -> upsertImportedProducts (line 1872) / handleInventoryImportFile (line 2039)

🔍 سبب المشكلة: عدم تحويل الأسعار والكميات لأرقام (Number/parseInt) أو غياب user_id الخاص بالجلسة مما يسبب رفض Supabase. عند استيراد ملفات CSV/Excel، يجب التأكد من:
1. تحويل unit_price, cost_price, stock_pieces إلى Number
2. إضافة user_id من auth.session.user.id
3. التحقق من أن جميع الحقول المطلوبة موجودة

🛠️ الكود المصحح:
\`\`\`typescript
// في دالة upsertImportedProducts (line 1872)
const sanitizedItem = {
  name: item.name.trim(),
  sku: item.sku?.trim() || "",
  unit_price: Number(item.unit_price) || 0,
  cost_price: Number(item.cost_price) || 0,
  stock_pieces: Number(item.stock_pieces) || 1,
  pieces_per_carton: Number(item.pieces_per_carton) || 1,
  low_stock_alert: Number(item.low_stock_alert) || 10,
  retail_type: item.retail_type || 'retail',
  unit_kind: item.unit_kind || 'piece',
};

// التأكد من user_id
const authUserId = session?.user?.id || user?.id;
if (!authUserId) {
  console.error('No auth user ID available');
  return 0;
}

toInsert.push({ ...sanitizedItem, user_id: authUserId });
\`\`\`

📋 برومبت التنفيذ لـ Devon:
\`\`\`
Fix inventory import failure in InventoryPosModule.tsx:

1. In upsertImportedProducts function (line 1872), ensure all numeric fields are converted using Number()
2. Add user_id from auth.session.user.id to all insert operations
3. Add null checks before processing each row
4. Handle the case where auth session is not available

Apply the fix to ensure CSV/Excel imports work correctly.
\`\`\`

📋 انسخ البرومبت لـ Devon من تبويب الأخطاء`;
    }
    
    if (lowerInput.includes("خطأ") || lowerInput.includes("error")) {
      const recentError = errorLogs[0];
      if (recentError) {
        return `📍 مكان المشكلة: ${recentError.file || "غير معروف"}:${recentError.line || "?"}

🔍 سبب المشكلة:
${recentError.arabicExplanation}

🛠️ الكود المصحح:
\`\`\`
${recentError.fixedCode || "// راجع الخطأ وأضف التحقق المناسب"}
\`\`\`

📋 برومبت التنفيذ لـ Devon:
\`\`\`
${recentError.devonPrompt || recentError.fixPrompt}
\`\`\`

📋 انسخ البرومبت لـ Devon من تبويب الأخطاء`;
      }
      return "لم يتم رصد أي أخطاء مؤخراً. إذا واجهت خطأً، سيتم رصده تلقائياً وعرضه هنا.";
    }
    
    if (lowerInput.includes("أمن") || lowerInput.includes("security")) {
      const recentAlert = securityAlerts[0];
      if (recentAlert) {
        return `⚠️ تنبيه أمني:\n\n${recentAlert.message}\n\nالجدول: ${recentAlert.table || "غير محدد"}\n\nخطوات الترقيع:\n${recentAlert.patchSteps.join("\n")}`;
      }
      return "لم يتم رصد أي ثغرات أمنية مؤخراً. النظام يراقب استجابات Supabase وسياسات RLS بشكل مستمر.";
    }
    
    if (lowerInput.includes("ميزة") || lowerInput.includes("feature") || lowerInput.includes("إضافة")) {
      return `📍 مكان المشكلة: طلب ميزة جديدة

🔍 سبب المشكلة: تحتاج لإضافة ميزة جديدة للنظام

🛠️ الكود المصحح:
أخبرني بالميزة المطلوبة بالتفصيل وسأقوم بـ:
1. رسم المخطط المعماري
2. تصميم قاعدة البيانات
3. توليد كود React/Tailwind
4. إضافة سياسات RLS

📋 برومبت التنفيذ لـ Devon:
\`\`\`
أخبرني بالميزة التي تريد إضافتها وسأقوم بتخطيطها وبناء الكود اللازم.
\`\`\`

📋 انسخ البرومبت لـ Devon من تبويب الأخطاء`;
    }
    
    if (lowerInput.includes("جدول") || lowerInput.includes("table")) {
      return `📍 مكان المشكلة: استعلام عن جداول قاعدة البيانات

🔍 سبب المشكلة: تحتاج معرفة هيكلية جداول المخزون

🛠️ الكود المصحح:
جداول قاعدة البيانات الرئيسية:
- **inventory_products**: المنتجات والمخزون (id, user_id, name, sku, unit_price, stock_pieces, الخ)
- **permissions**: صلاحيات المستخدمين
- **hr_employees**: الموظفين
- **shift_reports**: تقارير الورديات
- **customers**: العملاء

جميع الجداول لديها RLS: auth.uid()::text = user_id::text OR user_id IS NULL

📋 برومبت التنفيذ لـ Devon:
\`\`\`
استخدم المعلومات الموجودة في PROJECT_CONTEXT للتعامل مع جداول المخزون.
\`\`\`

📋 انسخ البرومبت لـ Devon من تبويب الأخطاء`;
    }
    
    return `📍 مكان المشكلة: استعلام عام

🔍 سبب المشكلة: تحتاج مساعدة في النظام

🛠️ الكود المصحح:
أنا مساعدك الذكي للسوبر أدمن خبير بقسم المخزون والمبيعات. يمكنني مساعدتك في:

🔍 تشخيص أخطاء استيراد المخزون (CSV/Excel)
🛡️ مراقبة الثغرات وسياسات RLS
🗣️ التحدث معي صوتياً
🏗️ بناء ميزات جديدة للمخزون
📊 تحليل كود InventoryPosModule.tsx

اسألني عن أي مشكلة في المخزون أو المبيعات.

📋 برومبت التنفيذ لـ Devon:
\`\`\`
استخدم المعرفة الشاملة بقسم المخزون والمبيعات في PROJECT_CONTEXT.
\`\`\`

📋 انسخ البرومبت لـ Devon من تبويب الأخطاء`;
  };

  // Don't render if not Super Admin
  if (!isSuperAdmin) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Main Widget */}
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
        isMinimized ? "w-14 h-14" : isExpanded ? "w-[600px] h-[700px]" : "w-[400px] h-[500px]"
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-white" />
            {!isMinimized && (
              <div>
                <h3 className="text-white font-bold text-sm">مساعد السوبر أدمن الذكي</h3>
                <p className="text-purple-200 text-xs">System Architect & AI Copilot</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isMinimized && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronUp className="w-4 h-4 text-white" />}
              </button>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              {isMinimized ? <ChevronUp className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Tabs */}
            <div className="bg-slate-800 border-b border-slate-700 flex">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "chat" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                💬 محادثة
              </button>
              <button
                onClick={() => setActiveTab("errors")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === "errors" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🔍 الأخطاء
                {errorLogs.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {errorLogs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === "security" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🛡️ الأمان
                {securityAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {securityAlerts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "features" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🏗️ الميزات
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col overscroll-contain">
              {activeTab === "chat" && (
                <div className="flex-1 flex flex-col">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto max-h-[80vh] overscroll-contain p-4 space-y-4" onScroll={(e) => e.stopPropagation()}>
                    {conversation.length === 0 && (
                      <div className="text-center text-slate-400 py-8">
                        <Bot className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                        <p className="text-sm">مرحباً! أنا مساعدك الذكي للسوبر أدمن</p>
                        <p className="text-xs mt-2">اسألني عن الأخطاء، الأمان، أو بناء ميزات جديدة</p>
                      </div>
                    )}
                    {conversation.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl p-3 ${
                            msg.role === "user"
                              ? "bg-purple-600 text-white"
                              : "bg-slate-700 text-slate-200"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs mt-1 opacity-60">
                            {msg.timestamp.toLocaleTimeString("ar-EG")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-slate-700">
                    <div className="flex gap-2">
                      <button
                        onClick={isListening ? stopListening : startListening}
                        className={`p-2 rounded-lg transition-colors ${
                          isListening ? "bg-red-600 text-white animate-pulse" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="اكتب رسالتك أو تحدث بصوتك..."
                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        إرسال
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "errors" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {errorLogs.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <Check className="w-12 h-12 mx-auto mb-4 text-green-400" />
                      <p className="text-sm">لا توجد أخطاء مسجلة</p>
                      <p className="text-xs mt-2">النظام يراقب الأخطاء تلقائياً</p>
                    </div>
                  ) : (
                    errorLogs.map((error) => (
                      <div key={error.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {error.type === "error" && <AlertTriangle className="w-4 h-4 text-red-400" />}
                            {error.type === "warning" && <Shield className="w-4 h-4 text-yellow-400" />}
                            <span className="text-xs font-medium text-slate-400">
                              📍 {error.file?.split("/").pop()}:{error.line || "?"}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {error.timestamp.toLocaleTimeString("ar-EG")}
                          </span>
                        </div>
                        <p className="text-sm text-red-300 mb-2">{error.message}</p>
                        
                        {/* Diagnosis Section */}
                        <div className="mb-3">
                          <p className="text-xs font-medium text-slate-400 mb-1">🔍 سبب المشكلة:</p>
                          <p className="text-xs text-slate-300">{error.arabicExplanation}</p>
                        </div>
                        
                        {/* Fixed Code Section */}
                        {error.fixedCode && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-slate-400 mb-1">🛠️ الكود المصحح:</p>
                            <pre className="bg-slate-900 rounded p-2 text-xs text-green-400 overflow-x-auto">
                              {error.fixedCode}
                            </pre>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(error.devonPrompt || error.fixPrompt, error.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors text-xs font-medium"
                          >
                            {copiedPrompt === error.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                تم النسخ لـ Devon
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                نسخ لـ Devon
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(error.fixPrompt, `${error.id}-fix`)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-xs"
                          >
                            {copiedPrompt === `${error.id}-fix` ? (
                              <>
                                <Check className="w-3 h-3" />
                                تم النسخ
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                نسخ البرومبت
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => speakText(error.arabicExplanation)}
                            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-xs"
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "security" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {securityAlerts.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <Shield className="w-12 h-12 mx-auto mb-4 text-green-400" />
                      <p className="text-sm">لا توجد ثغرات أمنية مسجلة</p>
                      <p className="text-xs mt-2">النظام يراقب استجابات Supabase وسياسات RLS</p>
                    </div>
                  ) : (
                    securityAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-lg p-3 border ${
                          alert.severity === "critical"
                            ? "bg-red-900/30 border-red-700"
                            : alert.severity === "high"
                            ? "bg-orange-900/30 border-orange-700"
                            : "bg-yellow-900/30 border-yellow-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-red-400" />
                            <span className={`text-xs font-medium ${
                              alert.severity === "critical" ? "text-red-400" : "text-orange-400"
                            }`}>
                              {alert.severity === "critical" ? "حرج" : alert.severity === "high" ? "عالي" : "متوسط"}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {alert.timestamp.toLocaleTimeString("ar-EG")}
                          </span>
                        </div>
                        <p className="text-sm text-red-300 mb-2">{alert.message}</p>
                        {alert.table && (
                          <p className="text-xs text-slate-400 mb-2">الجدول: {alert.table}</p>
                        )}
                        <div className="bg-slate-900/50 rounded-lg p-2">
                          <p className="text-xs text-slate-300 font-medium mb-1">خطوات الترقيع:</p>
                          <ul className="text-xs text-slate-400 space-y-1">
                            {alert.patchSteps.map((step, i) => (
                              <li key={`${alert.id}-step-${i}`}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "features" && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="text-center mb-6">
                    <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                    <h3 className="text-white font-bold mb-2">بناء الميزات الجديدة</h3>
                    <p className="text-slate-400 text-sm">أخبرني بالميزة التي تريد إضافتها وسأقوم بتخطيطها وبناء الكود</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <Code className="w-4 h-4 text-purple-400" />
                        التخطيط المعماري
                      </h4>
                      <p className="text-slate-400 text-sm">رسم مخطط الميزة الجديدة وتحديد المتطلبات</p>
                    </div>
                    
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-blue-400" />
                        قاعدة البيانات
                      </h4>
                      <p className="text-slate-400 text-sm">إنشاء جداول Supabase وسياسات RLS</p>
                    </div>
                    
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        كود React
                      </h4>
                      <p className="text-slate-400 text-sm">توليد مكونات React جاهزة مع Tailwind CSS</p>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="صف الميزة التي تريد إضافتها بالتفصيل..."
                      className="w-full h-32 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 resize-none"
                    />
                    <button
                      onClick={handleSendMessage}
                      className="w-full mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      بدء التخطيط والبناء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
