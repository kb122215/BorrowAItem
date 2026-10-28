// It turns a date like 2026-11-01T00:00:00.000Z into Nov 1, 2026.
const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

module.exports = formatDate;
