import { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';

export const parseExcel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'No file uploaded' } });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const allRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (allRows.length < 1) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'File appears to be empty' } });
    }

    const headers = allRows[0] as string[];
    const previewRows = allRows.slice(1, 6).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h: string, i: number) => { obj[h] = row[i]; });
      return obj;
    });

    const allData = allRows.slice(1).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h: string, i: number) => { obj[h] = row[i]; });
      return obj;
    });

    res.json({ success: true, data: { headers, previewRows, totalRows: allData.length, parsedData: allData } });
  } catch (err) { next(err); }
};
