// Navigation model shared by the sidebar and the router.
export const NAV_SECTIONS = [
  {
    title: "ראשי",
    items: [
      { path: "/", icon: "dashboard", label: "סקירה כללית", title: "סקירה כללית" },
    ],
  },
  {
    title: "עבודה",
    items: [
      {
        path: "/worklog",
        icon: "event_note",
        label: "רישום עבודה",
        title: "רישום עבודה",
      },
      {
        path: "/work-history",
        icon: "history",
        label: "היסטוריית עבודה",
        title: "היסטוריית עבודה",
      },
    ],
  },
  {
    title: "דוחות",
    items: [
      {
        path: "/reports",
        icon: "description",
        label: "דוחות למזמיני עבודה",
        title: "דוחות למזמיני עבודה",
      },
      {
        path: "/employee-reports",
        icon: "badge",
        label: "דוחות כוח אדם",
        title: "דוחות כוח אדם",
      },
    ],
  },
  {
    title: "ניהול",
    items: [
      {
        path: "/employees",
        icon: "groups",
        label: "עובדים וקבלנים",
        title: "עובדים וקבלנים",
      },
      {
        path: "/customers",
        icon: "person",
        label: "מזמיני עבודה",
        title: "מזמיני עבודה",
      },
      {
        path: "/sites",
        icon: "location_city",
        label: "אתרי עבודה",
        title: "אתרי עבודה",
      },
      {
        path: "/buildings",
        icon: "apartment",
        label: "מבנים",
        title: "מבנים",
      },
      {
        path: "/rates",
        icon: "payments",
        label: "תעריפים",
        title: "תעריפים",
      },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
