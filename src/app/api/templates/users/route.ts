import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const ROLES = ['Kullanıcı', 'Yönetici', 'İK Admin', 'İK Görüntüleyici', 'Tenant Admin']

export async function GET() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AION Mirror'

  const ws = wb.addWorksheet('Kullanıcılar')

  // Sütun tanımları ve genişlikler
  ws.columns = [
    { header: 'Ad Soyad',  key: 'full_name',   width: 24 },
    { header: 'E-posta',   key: 'email',        width: 30 },
    { header: 'Rol',       key: 'role',         width: 22 },
    { header: 'Departman', key: 'department',   width: 20 },
  ]

  // Başlık satırını kalın yap
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E0FF' },
  }

  // Örnek satır
  ws.addRow(['Ahmet Yılmaz', 'ahmet@sirket.com', 'Kullanıcı', 'Satış'])

  // Rol sütununa (C) dropdown validation ekle — satır 2'den 1001'e kadar
  for (let row = 2; row <= 1001; row++) {
    ws.getCell(`C${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${ROLES.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Geçersiz Rol',
      error: `Lütfen şunlardan birini seçin: ${ROLES.join(', ')}`,
    }
  }

  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="kullanici_sablonu.xlsx"',
    },
  })
}
