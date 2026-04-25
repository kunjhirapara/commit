export const formatLabel = (value?: string) =>
  value ? value.replace(/_/g, " ") : "unknown";
