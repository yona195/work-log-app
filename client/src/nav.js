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
        label: "היסטוריה",
        title: "היסטוריה",
      },
    ],
  },
  {
    title: "דוחות",
    items: [
      {
        path: "/reports",
        icon: "description",
        label: "דוחות מזמינים",
        title: "דוחות מזמינים",
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
        label: "עובדים",
        title: "עובדים",
      },
      {
        path: "/customers",
        icon: "person",
        label: "מזמינים",
        title: "מזמינים",
      },
      {
        path: "/sites",
        icon: "location_city",
        label: "אתרים",
        title: "אתרים",
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
