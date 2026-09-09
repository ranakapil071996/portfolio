/**
 * Tool catalog — add a category + slug here, then a matching /tools/{slug}/ page.
 */
window.TOOLS = {
  categories: [
    {
      id: "finance",
      tools: [
        {
          id: "emi",
          slug: "emi-calculator",
          navKey: "tools.emi.nav",
          titleKey: "tools.emi.title",
          blurbKey: "tools.emi.card",
        },
        {
          id: "sip",
          slug: "sip-calculator",
          navKey: "tools.sip.nav",
          titleKey: "tools.sip.title",
          blurbKey: "tools.sip.card",
        },
        {
          id: "gst",
          slug: "gst-calculator",
          navKey: "tools.gst.nav",
          titleKey: "tools.gst.title",
          blurbKey: "tools.gst.card",
        },
      ],
    },
  ],
};

window.TOOL_BY_ID = {};
window.TOOLS.categories.forEach(function (cat) {
  cat.tools.forEach(function (tool) {
    tool.category = cat.id;
    window.TOOL_BY_ID[tool.id] = tool;
  });
});
