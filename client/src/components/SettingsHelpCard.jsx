export default function SettingsHelpCard({ title, items }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3>{title}</h3>
      {items.map((item, index) => (
        <p key={item.label} style={index > 0 ? { marginTop: 10 } : undefined}>
          <strong>{item.label}</strong> - {item.text}
        </p>
      ))}
    </div>
  );
}
