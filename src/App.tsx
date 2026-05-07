import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/store/AuthStore";
import { OrderProvider } from "@/store/OrderStore";
import { QuoteProvider } from "@/store/QuoteStore";
import { FinanceProvider } from "@/store/FinanceStore";
import { DashboardFilterProvider } from "@/store/DashboardFilterStore";
import { LoginScreen } from "@/components/LoginScreen";
import { AppLayout } from "@/components/AppLayout";
import Sales from "@/pages/Sales";
import Financial from "@/pages/Financial";
import Dashboard from "@/pages/Dashboard";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados são considerados frescos por 30s antes de re-buscar em background
      staleTime: 30_000,
      // Cache mantido por 5 minutos após o componente desmontar
      gcTime: 5 * 60_000,
      // Não retentar em erros 4xx (são erros de negócio, não falhas transitórias)
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate() {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <LoginScreen />;

  return (
    <OrderProvider>
      <QuoteProvider>
        <FinanceProvider>
        <DashboardFilterProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Sales />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </DashboardFilterProvider>
        </FinanceProvider>
      </QuoteProvider>
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
