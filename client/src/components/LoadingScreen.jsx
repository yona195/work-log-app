export default function LoadingScreen({ message }) {
  return (
    <div className="loading-screen">
      <div className="loading-box">
        <img src="/logo.png" alt="לוגו החברה" className="loading-logo" />
        <h2>יומן עבודה</h2>
        <p>{message}</p>
        <div className="loading-bar">
          <div className="loading-bar-fill"></div>
        </div>
        <p className="loading-note">אנא המתן מספר שניות</p>
      </div>
    </div>
  );
}
