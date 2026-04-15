import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type LlamadaServicio } from '../features/tech/Llamadas/llamadasSlice'; 

// 🚨 Interfaz para evitar 'any' al acceder a lastAutoTable
interface jsPDFCustom extends jsPDF {
  lastAutoTable: { finalY: number };
}

export const generarPDFLiquidacion = (ordenes: LlamadaServicio[]) => {
  const doc = new jsPDF('p', 'pt', 'a4'); 

  doc.setFontSize(18);
  doc.text('Reporte de Liquidación de Órdenes de Servicio', 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Fecha de Generación: ${new Date().toLocaleDateString()}`, 40, 55);

  let startY = 80;

  ordenes.forEach((orden, index) => {
    if (startY > 700 && index > 0) {
      doc.addPage();
      startY = 40;
    }

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Orden de Servicio #${orden.id}`, 40, startY);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const headerData = [
      `Nro. Documento: ${orden.nroDocumento || 'N/A'}`,
      `Nro. Interno: ${orden.nroInterno || 'N/A'}`,
      `Equipo/Ítem: ${orden.itemIncidenciaId || 'N/A'}`,
      `Cliente: ${orden.clienteId || 'N/A'}`
    ];
    
    doc.text(headerData[0], 40, startY + 15);
    doc.text(headerData[1], 250, startY + 15);
    doc.text(headerData[2], 40, startY + 30);
    doc.text(headerData[3], 250, startY + 30);

    doc.setFont('helvetica', 'bold');
    doc.text('Resolución:', 40, startY + 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`Motivo ID: ${orden.motivoIncidenciaSTId || 'N/A'} | Solución ID: ${orden.solucionSTId || 'N/A'}`, 40, startY + 65);

    startY += 85;

    if (orden.detalles && orden.detalles.length > 0) {
      const tableData = orden.detalles.map(d => [
        d.tipo,
        d.descripcion || String(d.itemDetalleId),
        String(d.cantidad),
        `$${Number(d.valor).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: startY,
        head: [['Tipo', 'Descripción / Ítem', 'Cant.', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 },
        margin: { left: 40, right: 40 },
      });

      // Casteo seguro usando la interfaz
      startY = (doc as unknown as jsPDFCustom).lastAutoTable.finalY + 30; 
    } else {
      doc.setFont('helvetica', 'italic');
      doc.text('Sin repuestos ni servicios registrados.', 40, startY);
      startY += 30;
    }
    
    doc.setDrawColor(200);
    doc.line(40, startY - 15, 550, startY - 15);
  });

  doc.save(`Liquidacion_OS_${new Date().getTime()}.pdf`);
};