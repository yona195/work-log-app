export default function ActionsLegend() {
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <p>
        <strong>* ערוך</strong> - שינוי פרטי הרשומה (שם, שיוך וכו').
      </p>
      <p style={{ marginTop: 10 }}>
        <strong>* מחק</strong> - הסרה לצמיתות מהמערכת. משפיע גם על נתונים
        והיסטוריה שכבר נרשמו עם הרשומה הזו - מיועד לתיקון טעות הזנה, לא
        לשימוש שוטף.
      </p>
      <p style={{ marginTop: 10 }}>
        <strong>* ארכיון</strong> - מוסתר מרשומות חדשות, ההיסטוריה לא נפגעת,
        ואפשר לשחזר בכל רגע - האפשרות המומלצת ברוב המקרים.
      </p>
    </div>
  );
}
