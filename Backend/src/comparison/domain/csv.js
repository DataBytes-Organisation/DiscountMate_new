function toCsvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;

  return text;
}

function buildPlanCsv(run, plan) {
  const rows = [
    ['Retailer', 'Product', 'Quantity', 'Price (AUD)', 'Product URL'],
    ...(plan?.items || []).map((item) => [
      item.retailerName,
      item.productName,
      item.quantity,
      item.price?.amount,
      item.productUrl,
    ]),
  ];

  return rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n');
}

module.exports = { buildPlanCsv, toCsvCell };
