import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import Login from "./pages/Login.jsx";
import { useAuth } from "./state/AuthProvider.jsx";
import { DataProvider, useData } from "./state/DataProvider.jsx";
import { ToastProvider } from "./state/ToastProvider.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import WorkLog from "./pages/WorkLog.jsx";
import WorkHistory from "./pages/WorkHistory.jsx";
import Reports from "./pages/Reports.jsx";
import EmployeeReports from "./pages/EmployeeReports.jsx";
import Employees from "./pages/Employees.jsx";
import Buildings from "./pages/Buildings.jsx";
import Rates from "./pages/Rates.jsx";
import SimpleManager from "./pages/SimpleManager.jsx";

function AuthenticatedApp() {
  const { phase, error } = useData();

  if (phase === "loading") {
    return <LoadingScreen message="טוען נתונים..." />;
  }
  if (phase === "error") {
    return (
      <LoadingScreen
        message={`לא ניתן לטעון נתונים מהשרת. ${error || ""}`.trim()}
      />
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/worklog" element={<WorkLog />} />
        <Route path="/work-history" element={<WorkHistory />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/employee-reports" element={<EmployeeReports />} />
        <Route path="/employees" element={<Employees />} />
        <Route
          path="/sites"
          element={
            <SimpleManager
              collection="sites"
              placeholder="שם אתר"
              editTitle="עריכת אתר עבודה"
              key="sites"
            />
          }
        />
        <Route path="/buildings" element={<Buildings />} />
        <Route
          path="/customers"
          element={
            <SimpleManager
              collection="customers"
              placeholder="שם מזמין"
              editTitle="עריכת מזמין עבודה"
              key="customers"
            />
          }
        />
        <Route path="/rates" element={<Rates />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return <LoadingScreen message="טוען..." />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <ToastProvider>
      <DataProvider>
        <AuthenticatedApp />
      </DataProvider>
    </ToastProvider>
  );
}
