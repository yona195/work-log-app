import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import Login from "./pages/Login.jsx";
import { useAuth } from "./state/AuthProvider.jsx";
import { DataProvider, useData } from "./state/DataProvider.jsx";
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
              key="sites"
              helpTitle="מה זה אתרי עבודה?"
              helpItems={[
                {
                  label: "אתר עבודה",
                  text: "המיקום הפיזי שבו מתבצעת העבודה - למשל שם פרויקט או כתובת.",
                },
                {
                  label: "קשר למבנים ולתעריפים",
                  text: 'כל אתר יכול להכיל כמה "מבנים" (מנוהלים בעמוד מבנים), ומשמש גם לרישום יומן עבודה וגם להגדרת תעריפים.',
                },
              ]}
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
              key="customers"
              helpTitle="מה זה מזמיני עבודה?"
              helpItems={[
                {
                  label: "מזמין עבודה",
                  text: 'הלקוח שעבורו מתבצעת העבודה בפועל - מי ש"מזמין" את העבודה ומשלם עליה.',
                },
                {
                  label: "קשר לתעריפים ולדוחות",
                  text: 'לפי המזמין (יחד עם האתר) נקבע תעריף ההכנסה בעמוד תעריפים, וניתן להפיק לו דוחות ייעודיים בעמוד "דוחות מזמין".',
                },
              ]}
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
    <DataProvider>
      <AuthenticatedApp />
    </DataProvider>
  );
}
