// @ts-ignore
import PDFDocument from "pdfkit";
import { Readable } from "stream";
// @ts-ignore
import QRCode from "qrcode";

interface VisaData {
  visaNumber: string;
  applicationId: number;
  fullName: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  visaType: string;
  destinationCountry: string;
  intendedEntryDate: string | null;
  intendedExitDate: string | null;
  purposeOfVisit: string;
  grantedAt: Date | string | null;
  expiryDate: string | null;
  riskLevel: string | null;
}

export async function generateVisaPDF(visaData: VisaData): Promise<Readable> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
  });

  // Generate QR code that points to verification URL
  const verificationUrl = `${process.env.BASE_URL || "http://localhost:5000"}/verify/${visaData.visaNumber}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 150,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  // Header Section
  doc.fontSize(10).text("IMMIGRATION AUTHORITY PORTAL", { align: "center" }).moveDown(0.3);
  doc.fontSize(24).font("Helvetica-Bold").text("DIGITAL STUDENT VISA", { align: "center" }).moveDown(1);

  // Horizontal line
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke().moveDown(1);

  // Visa Details Header
  const headerY = doc.y;
  doc.fontSize(10).font("Helvetica-Bold").text(`VISA NUMBER: ${visaData.visaNumber}`, { width: 250 });
  doc.fontSize(9).text(`Application ID: ${visaData.applicationId}`, { width: 250 });

  doc.fontSize(10).font("Helvetica-Bold").text(`Issue Date: ${formatDate(visaData.grantedAt)}`, { x: 320, y: headerY, width: 200 });
  doc.fontSize(9).text(`Expiry Date: ${visaData.expiryDate || "N/A"}`, { x: 320 });

  doc.moveDown(1.5);

  // Applicant Information Section
  doc.fontSize(12).font("Helvetica-Bold").text("APPLICANT INFORMATION", { underline: true }).moveDown(0.5);
  doc.fontSize(10).font("Helvetica");

  const applicantInfo = [
    { label: "Full Name:", value: visaData.fullName },
    { label: "Passport Number:", value: visaData.passportNumber },
    { label: "Nationality:", value: visaData.nationality },
    { label: "Date of Birth:", value: visaData.dateOfBirth },
  ];

  applicantInfo.forEach(({ label, value }) => {
    doc.fontSize(10).font("Helvetica-Bold").text(label, { width: 150, continued: true });
    doc.fontSize(10).font("Helvetica").text(value);
  });

  doc.moveDown(1);

  // Visa Details Section
  doc.fontSize(12).font("Helvetica-Bold").text("VISA DETAILS", { underline: true }).moveDown(0.5);
  doc.fontSize(10).font("Helvetica");

  const visaDetails = [
    { label: "Visa Type:", value: visaData.visaType.charAt(0).toUpperCase() + visaData.visaType.slice(1) },
    { label: "Destination Country:", value: visaData.destinationCountry },
    { label: "Intended Entry Date:", value: visaData.intendedEntryDate || "N/A" },
    { label: "Intended Exit Date:", value: visaData.intendedExitDate || "N/A" },
    { label: "Purpose of Travel:", value: visaData.purposeOfVisit },
  ];

  visaDetails.forEach(({ label, value }) => {
    doc.fontSize(10).font("Helvetica-Bold").text(label, { width: 150, continued: true });
    doc.fontSize(10).font("Helvetica").text(value);
  });

  doc.moveDown(1);

  // Security Verification Section
  doc.fontSize(12).font("Helvetica-Bold").text("SECURITY VERIFICATION", { underline: true }).moveDown(0.5);
  doc.fontSize(9).font("Helvetica");

  const riskStatus = visaData.riskLevel ? visaData.riskLevel.charAt(0).toUpperCase() + visaData.riskLevel.slice(1) + " Risk" : "Not Assessed";

  const verificationItems = [
    { label: "AI Document Verification:", value: "✓ Verified", color: "#22c55e" },
    { label: "Security Background Check:", value: "✓ Cleared", color: "#22c55e" },
    { label: "Risk Assessment:", value: `✓ ${riskStatus}`, color: riskStatus === "Low Risk" ? "#22c55e" : "#f59e0b" },
    { label: "Final Decision:", value: "✓ Approved", color: "#22c55e" },
  ];

  verificationItems.forEach(({ label, value, color }) => {
    doc.fontSize(9).font("Helvetica-Bold").text(label, { width: 200, continued: true });
    doc.fontSize(9).font("Helvetica").fillColor(color).text(value);
    doc.fillColor("black");
  });

  doc.moveDown(1.5);

  // QR Code Section (centered)
  const qrX = (doc.page.width - 150) / 2;
  doc.fontSize(11).font("Helvetica-Bold").text("QR CODE VERIFICATION", { align: "center" }).moveDown(0.3);

  // Convert QR code image and embed
  const qrImageBuffer = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");
  doc.image(qrImageBuffer, qrX, doc.y, { width: 150, height: 150 });
  doc.moveDown(6);

  doc.fontSize(9).text("Scan to verify visa authenticity", { align: "center" }).moveDown(1);

  // Horizontal line
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke().moveDown(1);

  // Footer Section
  doc.fontSize(8).font("Helvetica").fillColor("#666666");
  doc.text("IMMIGRATION AUTHORITY DIGITAL SEAL", { align: "center" }).moveDown(0.3);
  doc.text("This is a system-generated document. It holds legal validity as per the standards.", { align: "center", width: 475 });
  doc.moveDown(0.3);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });

  // Return the PDF stream
  return doc;
}

function formatDate(dateString: string | Date | null): string {
  if (!dateString) return "N/A";
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return String(dateString);
  }
}
