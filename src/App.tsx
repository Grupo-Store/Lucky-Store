import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/store/AuthStore";
import { OrderProvider } from "@/store/OrderStore";
import { LoginScreen } from "@/components/LoginScreen";
import { AppLayout } from "@/components/AppLayout";
import Sales from "@/pages/Sales";
import Dashboard from "@/pages/Dashboard";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AuthGate() {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <LoginScreen />;

  return (
    <OrderProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Sales />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </OrderProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
