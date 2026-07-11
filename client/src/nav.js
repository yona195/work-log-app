// Navigation model shared by the sidebar and the router.
export const NAV_SECTIONS = [
  {
    title: "עבודה יומית",
    items: [
      { path: "/", icon: "dashboard", label: "סקירה כללית", title: "סקירה כללית" },
      {
        path: "/worklog",
        icon: "event_note",
        label: "יומן עבודה",
        title: "יומן עבודה",
      },
      {
        path: "/reports",
        icon: "description",
        label: "דוחות",
        title: "דוחות",
      },
    ],
  },
  {
    title: "הגדרות",
    items: [
      { path: "/employees", icon: "groups", label: "עובדים", title: "עובדים" },
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
        path: "/customers",
        icon: "person",
        label: "מזמיני עבודה",
        title: "מזמיני עבודה",
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
