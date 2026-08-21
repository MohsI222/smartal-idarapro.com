import { Component, ReactNode } from "react";
import { PUBLIC_SUPER_ADMIN_EMAIL } from "@/constants/publicSuperAdmin";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary that catches React errors
 * and forwards them to the Super Admin AI Copilot
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Forward error to Super Admin AI Copilot if user is Super Admin
    const user = JSON.parse(localStorage.getItem("idara_user") || "{}");
    const isSuperAdmin = user.email?.toLowerCase() === PUBLIC_SUPER_ADMIN_EMAIL;

    if (isSuperAdmin) {
      // Store error in localStorage for the AI Copilot to pick up
      const errorLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        type: "react_error",
      };

      const existingLogs = JSON.parse(localStorage.getItem("superadmin_errors") || "[]");
      localStorage.setItem("superadmin_errors", JSON.stringify([errorLog, ...existingLogs].slice(0, 50)));
    }

    console.error("Global Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#060d18]">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-400 mb-4">حدث خطأ غير متوقع</h1>
            <p className="text-slate-400 mb-4">
              {this.state.error?.message || "تم رصد الخطأ وإرساله للسوبر أدمن"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
