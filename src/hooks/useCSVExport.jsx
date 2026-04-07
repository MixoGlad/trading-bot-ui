import { useState, useCallback } from 'react';

const useCSVExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = useCallback((data, headers, filename = 'export.csv', transformRow) => {
    setIsExporting(true);
    try {
      if (!data || !data.length) {
        return;
      }

      const csvHeaders = headers || Object.keys(data[0]);
      const headerRow = csvHeaders.join(',');

      const rows = data.map((item) => {
        let values;
        if (transformRow) {
          // If a transform function is provided, use it to get an array of raw values
          values = transformRow(item);
        } else {
          // Default behavior: map headers to object keys
          values = csvHeaders.map((header) => item[header]);
        }

        // Escape quotes and wrap values in quotes
        return values
          .map((val) => {
            const stringVal = String(val !== undefined && val !== null ? val : '');
            return `"${stringVal.replace(/"/g, '""')}"`;
          })
          .join(',');
      });

      const csvContent = [headerRow, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV Export Error:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToCSV, isExporting };
};

export default useCSVExport;