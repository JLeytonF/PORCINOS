function escapeCsv(value) {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `\"${raw.replace(/\"/g, '\"\"')}\"`;
  }
  return raw;
}

export function downloadCsv(fileName, rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    const line = headers.map((h) => escapeCsv(row[h])).join(",");
    lines.push(line);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
