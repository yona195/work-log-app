import { useState } from "react";
import { useAuth } from "../state/AuthProvider.jsx";

export default function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!password) {
      setError("נא להזין סיסמה");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await login(password);
      // On success the AuthProvider flips isAuthenticated and App swaps views.
    } catch (err) {
      setError(err.message || "ההתחברות נכשלה");
      setSubmitting(false);
    }
  };

  return (
    <div className="loading-screen">
      <div className="loading-box">
        <img src="/logo.png" alt="לוגו החברה" className="loading-logo" />
        <h2>יומן עבודה</h2>
        <p>התחברות למערכת</p>

        <form onSubmit={submit} style={{ textAlign: "right", marginTop: 8 }}>
          <label htmlFor="loginPassword">סיסמה</label>
          <input
            id="loginPassword"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="הזן סיסמה"
          />

          {error && (
            <p style={{ color: "var(--color-danger)", fontWeight: 600, marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-btn"
            style={{ width: "100%" }}
            disabled={submitting}
          >
            {submitting ? "מתחבר..." : "התחבר"}
          </button>
        </form>
      </div>
    </div>
  );
}
