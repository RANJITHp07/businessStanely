import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

// Helper to decode JWT and get exp
function getTokenExpiration(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export default function AuthSessionTimeout() {
  const [showDialog, setShowDialog] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const exp = getTokenExpiration(token);
    if (!exp) return;
    const now = Date.now();
    const msUntilExpiry = exp - now;
    if (msUntilExpiry <= 0) {
      // Already expired
      setShowDialog(true);
      setTimeout(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("agent");
        router.replace("/login");
      }, 2000);
      return;
    }
    const timeout = setTimeout(() => {
      setShowDialog(true);
      setTimeout(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("agent");
        router.replace("/login");
      }, 2000);
    }, msUntilExpiry);
    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <AlertDialog open={showDialog}>
      <AlertDialogContent
        style={{
          border: '2px solid #dc2626',
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          boxShadow: '0 0 0 4px #fee2e2',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              border: '4px solid #fee2e2',
              borderTop: '4px solid #dc2626',
              borderRadius: '50%',
              width: 48,
              height: 48,
              animation: 'spin 1s linear infinite',
              marginBottom: 12,
            }}
          />
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: '#dc2626' }}>Session Timed Out</AlertDialogTitle>
            <AlertDialogDescription style={{ color: '#b91c1c', fontWeight: 'bold' }}>
              Your session has expired. Logging out...
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </AlertDialogContent>
    </AlertDialog>
  );
}
