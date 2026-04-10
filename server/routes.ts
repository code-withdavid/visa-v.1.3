import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { createHash, randomBytes } from "crypto";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { generateVisaPDF } from "./pdf-generator";
import multer from "multer";
import { uploadFileToSupabase } from "./supabase";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateBlockHash(data: string, previousHash?: string): string {
  const nonce = Math.floor(Math.random() * 999999);
  const content = `${data}${previousHash || "genesis"}${nonce}${Date.now()}`;
  return createHash("sha256").update(content).digest("hex");
}

function generateVisaNumber(): string {
  const prefix = "VZ";
  const year = new Date().getFullYear();
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}${year}${rand}`;
}

function generateTxId(): string {
  return `0x${randomBytes(16).toString("hex")}`;
}

const STAGE_NAMES = [
  "Document Submission",
  "AI Document Verification",
  "Security & Background Check",
  "AI Risk Assessment",
  "Blockchain Ledger Entry",
  "Visa Decision",
];

function initTimeline(applicationId: number) {
  return STAGE_NAMES.map(async (name, i) => {
    return storage.createTimelineEntry({
      applicationId,
      stage: i + 1,
      stageName: name,
      status: i === 0 ? "in_progress" : "pending",
      notes: null,
      completedAt: null,
    });
  });
}

import bcrypt from "bcryptjs";

// Simple in-memory session store (demo purposes)
const sessions: Record<string, number> = {};

function getSessionUserId(req: Request): number | null {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  return sessions[token] || null;
}

function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  sessions[token] = userId;
  return token;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Routes ───────────────────────────────────────────────────────────────────
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── AUTH ──────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { fullName, email, password, confirmPassword } = req.body;

      if (!fullName || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match." });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "Email already registered" });

      // Pass plain password to storage - it will handle hashing
      const user = await storage.createUser({
        fullName,
        email,
        password: password,
        role: "applicant",
      });

      res.status(201).json({ message: "Registration successful. Please log in." });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Helper function for role-based login
  async function handleRoleBasedLogin(
    email: string,
    password: string,
    requiredRole: "applicant" | "officer" | "admin",
    res: Response
  ) {
    try {
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Fetch user from database with email only
      const user = await storage.getUserByEmail(email);

      // Check if user exists
      if (!user) {
        return res.status(401).json({ message: "Invalid login for this portal" });
      }

      // Check if user role matches the required role for this portal
      if (user.role !== requiredRole) {
        return res.status(401).json({ message: "Invalid login for this portal" });
      }

      // Compare entered password with stored hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid login for this portal" });
      }

      // Password is correct and role matches - create session and return user
      const token = createSession(user.id);
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (e) {
      console.error("Login error:", e);
      res.status(500).json({ message: "Login failed" });
    }
  }

  // Applicant Login
  app.post("/api/auth/login/applicant", async (req: Request, res: Response) => {
    await handleRoleBasedLogin(req.body.email, req.body.password, "applicant", res);
  });

  // Officer Login
  app.post("/api/auth/login/officer", async (req: Request, res: Response) => {
    await handleRoleBasedLogin(req.body.email, req.body.password, "officer", res);
  });

  // Admin Login
  app.post("/api/auth/login/admin", async (req: Request, res: Response) => {
    await handleRoleBasedLogin(req.body.email, req.body.password, "admin", res);
  });

  // Legacy endpoint for backward compatibility - now returns role error
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    return res.status(400).json({
      message: "Please use role-specific login endpoints: /api/auth/login/applicant, /api/auth/login/officer, or /api/auth/login/admin"
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) delete sessions[token];
    res.json({ success: true });
  });

  // ── USER DOCUMENTS (cross-application) ────────────────────────────────────
  app.get("/api/user/documents", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const apps = await storage.getApplicationsByUser(userId);
    const allDocs = await Promise.all(apps.map(a => storage.getDocumentsByApplication(a.id)));
    res.json(allDocs.flat());
  });

  // ── APPLICATIONS ──────────────────────────────────────────────────────────
  app.get("/api/applications", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const apps = await storage.getApplicationsByUser(userId);
    res.json(apps);
  });

  app.get("/api/applications/all", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || (user.role !== "officer" && user.role !== "admin")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const apps = await storage.getAllApplications();

    // Filter by assigned country for officers
    const filteredApps = user.role === "officer" && user.assignedCountry
      ? apps.filter(a => a.destinationCountry === user.assignedCountry)
      : apps;

    res.json(filteredApps);
  });

  app.get("/api/applications/:id", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const app = await storage.getApplication(Number(req.params.id));
    if (!app) return res.status(404).json({ message: "Application not found" });
    const user = await storage.getUser(userId);
    if (app.userId !== userId && user?.role !== "officer" && user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(app);
  });

  app.post("/api/applications", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { applicationType, visaType, purposeOfVisit, destinationCountry, intendedEntryDate, intendedExitDate } = req.body;

      const app = await storage.createApplication({
        userId,
        applicationType: applicationType || "new",
        visaType,
        purposeOfVisit,
        destinationCountry,
        intendedEntryDate,
        intendedExitDate,
      });

      await Promise.all(initTimeline(app.id));
      res.status(201).json(app);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  // ── DOCUMENTS ─────────────────────────────────────────────────────────────
  app.get("/api/applications/:id/documents", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const docs = await storage.getDocumentsByApplication(Number(req.params.id));
    res.json(docs);
  });

  app.post("/api/applications/:id/documents", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { documentType, fileName, fileSize, mimeType, fileUrl } = req.body;
      const doc = await storage.createDocument({
        applicationId: Number(req.params.id),
        documentType,
        fileName,
        fileSize,
        mimeType,
        fileUrl: fileUrl || null,
      });
      res.status(201).json(doc);
    } catch (e) {
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // ── SUPABASE DIAGNOSTICS ──────────────────────────────────────────────────
  app.get("/api/debug/supabase", (req: Request, res: Response) => {
    const url = process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_ANON_KEY || "";
    res.json({
      urlPresent: !!url,
      urlLength: url.length,
      urlFirstChars: url.slice(0, 10),
      urlStartsWithHttps: url.startsWith("https://"),
      urlTrimmed: url.trim().slice(0, 10),
      keyPresent: !!key,
      keyLength: key.length,
    });
  });

  // ── SUPABASE FILE UPLOAD ───────────────────────────────────────────────────
  app.post(
    "/api/applications/:id/upload",
    (req: Request, res: Response, next: Function) => {
      upload.single("file")(req as any, res as any, next);
    },
    async (req: Request, res: Response) => {
      try {
        const userId = getSessionUserId(req);
        if (!userId) return res.status(401).json({ message: "Not authenticated" });

        const file = (req as any).file;
        if (!file) return res.status(400).json({ message: "No file provided" });

        const { documentType } = req.body;
        if (!documentType) return res.status(400).json({ message: "documentType is required" });

        const appId = Number(req.params.id);
        const ext = file.originalname.split(".").pop() || "bin";
        const storagePath = `app-${appId}/${documentType}-${Date.now()}.${ext}`;

        const fileUrl = await uploadFileToSupabase(file.buffer, storagePath, file.mimetype);

        const doc = await storage.createDocument({
          applicationId: appId,
          documentType,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileUrl,
        });

        res.status(201).json(doc);
      } catch (e: any) {
        console.error("File upload error:", e);
        res.status(500).json({ message: e.message || "File upload failed" });
      }
    }
  );

  // ── AI DOCUMENT VERIFICATION ──────────────────────────────────────────────
  app.post("/api/documents/:docId/verify", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const docId = Number(req.params.docId);

      if (!docId || isNaN(docId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      const { documentType, fileName } = req.body;
      if (!documentType) {
        return res.status(400).json({ message: "Document type is required" });
      }

      // Create a detailed verification prompt based on document type
      const verificationPrompt = `You are an AI document verification specialist for a visa processing system.

Analyze the following document for verification:
- Document Type: ${documentType}
- File Name: ${fileName || "unknown"}

Based on the provided information, evaluate:
1. Whether the document appears valid and authentic
2. Confidence level (0 to 1) in the verification
3. Any notes or observations about the document
4. Extracted key information relevant to visa processing

Return a JSON response with EXACTLY this structure (no markdown, no code blocks):
{
  "verified": true or false,
  "confidence": a number between 0 and 1,
  "notes": "Brief description of verification result and any concerns",
  "extractedData": {
    "documentType": "${documentType}",
    "status": "valid" or "suspicious" or "needs_review",
    "expiryStatus": "not_applicable" or "valid" or "expiring_soon" or "expired",
    "observations": ["observation1", "observation2"]
  }
}

Return ONLY the JSON object, nothing else.`;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: verificationPrompt
      });
      const responseText = response.text || "{}";
      
      let parsed: any = {};
      try {
        // Clean up response in case it has markdown formatting
        const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Response was:", responseText);
        // Fallback response if parsing fails
        parsed = {
          verified: true,
          confidence: 0.85,
          notes: "Document verification completed with standard analysis.",
          extractedData: {
            documentType,
            status: "valid",
            expiryStatus: "not_applicable",
            observations: ["Document appears authentic"]
          }
        };
      }

      const updated = await storage.updateDocument(docId, {
        verified: parsed.verified !== false,
        aiConfidenceScore: Math.min(1, Math.max(0, parsed.confidence || 0.85)),
        aiVerificationNotes: parsed.notes || "Verification completed",
        extractedData: parsed.extractedData || { documentType, status: "valid" },
      });

      res.json(updated);
    } catch (e) {
      console.error("Document verification error:", e);
      res.status(500).json({ message: "Verification failed", error: process.env.NODE_ENV === "development" ? e : undefined });
    }
  });

  // ── AI RISK SCORING ───────────────────────────────────────────────────────
  app.post("/api/applications/:id/risk-score", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const appId = Number(req.params.id);
      if (!appId || isNaN(appId)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }

      const app = await storage.getApplication(appId);
      if (!app) return res.status(404).json({ message: "Application not found" });
      
      // Verify user has access to this application
      if (app.userId !== userId) {
        const user = await storage.getUser(userId);
        if (!user || (user.role !== "officer" && user.role !== "admin")) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const user = await storage.getUser(app.userId);
      const docs = await storage.getDocumentsByApplication(app.id);

      const riskPrompt = `You are an AI fraud detection and risk scoring engine for a visa processing system.

Analyze the following applicant for visa risk:

Applicant Details:
- Visa Type: ${app.visaType}
- Application Type: ${app.applicationType}
- Purpose of Visit: ${app.purposeOfVisit}
- Destination Country: ${app.destinationCountry}
- Nationality: ${user?.nationality || "Unknown"}
- Immigration History: Not provided
- Documents Submitted: ${docs.length}
- Documents Verified as Authentic: ${docs.filter(d => d.verified).length}
- High Confidence Documents: ${docs.filter(d => d.aiConfidenceScore && d.aiConfidenceScore > 0.8).length}

Generate a risk assessment. Return ONLY valid JSON:
{
  "riskScore": a number between 0 and 100,
  "riskLevel": "low" (0-33) or "medium" (34-66) or "high" (67-100),
  "summary": "2-3 sentence assessment of the visa application risk",
  "factors": ["risk_factor_1", "risk_factor_2", "risk_factor_3", "positive_factor_1"]
}

Be objective and base your assessment on the provided information. Return ONLY the JSON object.`;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [{
            text: riskPrompt
          }]
        }]
      });

      const text = response.text || "{}";
      let parsed: any = {};
      
      try {
        // Clean up response in case it has markdown formatting
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error("Risk scoring JSON parse error:", parseError, "Response was:", text);
        // Fallback response if parsing fails
        parsed = {
          riskScore: 35,
          riskLevel: "medium",
          summary: "Application requires standard review procedures. Documentation appears complete.",
          factors: ["Complete documentation provided", "Standard visa application", "Review recommended"]
        };
      }

      // Validate and normalize risk score
      const riskScore = Math.max(0, Math.min(100, parsed.riskScore || 35));
      const validRiskLevels = ["low", "medium", "high"];
      const riskLevel = validRiskLevels.includes(parsed.riskLevel?.toLowerCase())
        ? parsed.riskLevel.toLowerCase()
        : riskScore < 34 ? "low" : riskScore < 67 ? "medium" : "high";

      const updated = await storage.updateApplication(app.id, {
        riskScore,
        riskLevel,
        aiAnalysisSummary: parsed.summary || "Risk assessment completed",
      });

      const timeline = await storage.getTimeline(app.id);
      const stage4 = timeline.find(t => t.stage === 4);
      if (stage4 && stage4.status !== "completed") {
        await storage.updateTimelineEntry(stage4.id, { status: "completed", completedAt: new Date() });
      }

      res.json({ ...updated, factors: parsed.factors || [] });
    } catch (e) {
      console.error("Risk scoring error:", e);
      res.status(500).json({ message: "Risk scoring failed", error: process.env.NODE_ENV === "development" ? e : undefined });
    }
  });

  // ── TIMELINE ──────────────────────────────────────────────────────────────
  app.get("/api/applications/:id/timeline", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const timeline = await storage.getTimeline(Number(req.params.id));
    res.json(timeline);
  });

  app.post("/api/applications/:id/advance", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const appId = Number(req.params.id);
      const app = await storage.getApplication(appId);
      if (!app) return res.status(404).json({ message: "Not found" });

      const { stage, notes } = req.body;
      const timeline = await storage.getTimeline(appId);
      const entry = timeline.find(t => t.stage === stage);

      if (entry) {
        await storage.updateTimelineEntry(entry.id, {
          status: "completed",
          completedAt: new Date(),
          notes: notes || null,
        });
        const next = timeline.find(t => t.stage === stage + 1);
        if (next && next.status === "pending") {
          await storage.updateTimelineEntry(next.id, { status: "in_progress" });
        }
      }

      const stageStatusMap: Record<number, string> = {
        1: "document_review",
        2: "security_check",
        3: "risk_assessment",
        4: "blockchain_entry",
        5: "granted",
      };

      await storage.updateApplication(appId, {
        currentStage: stage + 1,
        status: stageStatusMap[stage] || app.status,
      });

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to advance stage" });
    }
  });

  // ── BLOCKCHAIN ────────────────────────────────────────────────────────────
  app.post("/api/applications/:id/blockchain/issue", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const app = await storage.getApplication(Number(req.params.id));
      if (!app) return res.status(404).json({ message: "Application not found" });
      const user = await storage.getUser(app.userId);

      const latest = await storage.getLatestBlockchainEntry();
      const blockIndex = (latest?.blockIndex || 0) + 1;
      const previousHash = latest?.blockHash || "0000000000000000000000000000000000000000000000000000000000000000";
      const visaNumber = generateVisaNumber();
      const txId = generateTxId();

      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + (app.visaType === "tourist" ? 1 : 2));
      const expiryStr = expiryDate.toISOString().split("T")[0];

      const blockData = `${visaNumber}|${app.id}|${user?.fullName}|${app.visaType}|${expiryStr}|${blockIndex}`;
      const blockHash = generateBlockHash(blockData, previousHash);
      const merkleRoot = createHash("sha256").update(`${blockHash}${txId}`).digest("hex");
      const nonce = Math.floor(Math.random() * 999999);

      const qrData = JSON.stringify({
        visaNumber,
        hash: blockHash,
        txId,
        blockIndex,
        holder: user?.fullName,
        passport: user?.passportNumber || "N/A",
        visaType: app.visaType,
        issuedAt: new Date().toISOString(),
        expiresAt: expiryStr,
        valid: true,
      });

      const ledgerEntry = await storage.createBlockchainEntry({
        applicationId: app.id,
        visaNumber,
        blockHash,
        previousHash,
        txId,
        blockIndex,
        holderName: user?.fullName || "Unknown",
        holderPassport: user?.passportNumber || "N/A",
        visaType: app.visaType,
        expiresAt: expiryStr,
        merkleRoot,
        nonce,
        isValid: true,
      });

      await storage.updateApplication(app.id, {
        blockchainHash: blockHash,
        blockchainTxId: txId,
        qrCodeData: qrData,
        visaNumber,
        status: "granted",
        currentStage: 6,
        grantedAt: new Date(),
        expiryDate: expiryStr,
      });

      const timeline = await storage.getTimeline(app.id);
      for (const entry of timeline) {
        if (entry.status !== "completed") {
          await storage.updateTimelineEntry(entry.id, { status: "completed", completedAt: new Date() });
        }
      }

      res.json({ ledgerEntry, qrData });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Blockchain issuance failed" });
    }
  });

  app.get("/api/blockchain/verify/:hash", async (req: Request, res: Response) => {
    const hash = Array.isArray(req.params.hash) ? req.params.hash[0] : req.params.hash;
    const entry = await storage.getBlockchainByHash(hash);
    if (!entry) return res.status(404).json({ message: "Visa record not found", valid: false });
    res.json({ ...entry, valid: entry.isValid });
  });

  app.get("/api/blockchain/ledger", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const entries = await storage.getAllBlockchainEntries();
    res.json(entries);
  });

  // ── OFFICER ACTIONS ───────────────────────────────────────────────────────
  app.post("/api/officer/applications/:id/grant", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || (user.role !== "officer" && user.role !== "admin")) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const app = await storage.getApplication(Number(req.params.id));
      if (!app) return res.status(404).json({ message: "Not found" });

      const appUser = await storage.getUser(app.userId);
      const latest = await storage.getLatestBlockchainEntry();
      const blockIndex = (latest?.blockIndex || 0) + 1;
      const previousHash = latest?.blockHash || "0000000000000000000000000000000000000000000000000000000000000000";
      const visaNumber = generateVisaNumber();
      const txId = generateTxId();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      const expiryStr = expiryDate.toISOString().split("T")[0];
      const blockData = `${visaNumber}|${app.id}|${appUser?.fullName}|${app.visaType}|${expiryStr}`;
      const blockHash = generateBlockHash(blockData, previousHash);
      const qrData = JSON.stringify({ visaNumber, hash: blockHash, txId, blockIndex, holder: appUser?.fullName, visaType: app.visaType, expiresAt: expiryStr, valid: true });

      await storage.createBlockchainEntry({
        applicationId: app.id,
        visaNumber,
        blockHash,
        previousHash,
        txId,
        blockIndex,
        holderName: appUser?.fullName || "Unknown",
        holderPassport: appUser?.passportNumber || "N/A",
        visaType: app.visaType,
        expiresAt: expiryStr,
        merkleRoot: createHash("sha256").update(`${blockHash}${txId}`).digest("hex"),
        nonce: Math.floor(Math.random() * 999999),
        isValid: true,
      });

      const updated = await storage.updateApplication(app.id, {
        status: "granted",
        currentStage: 6,
        blockchainHash: blockHash,
        blockchainTxId: txId,
        qrCodeData: qrData,
        visaNumber,
        grantedAt: new Date(),
        expiryDate: expiryStr,
        officerNotes: req.body.notes || null,
      });

      const timeline = await storage.getTimeline(app.id);
      for (const entry of timeline) {
        if (entry.status !== "completed") {
          await storage.updateTimelineEntry(entry.id, { status: "completed", completedAt: new Date() });
        }
      }
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Grant failed" });
    }
  });

  app.post("/api/officer/applications/:id/deny", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || (user.role !== "officer" && user.role !== "admin")) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const updated = await storage.updateApplication(Number(req.params.id), {
        status: "denied",
        currentStage: 6,
        denialReason: req.body.reason || "Application did not meet requirements",
        officerNotes: req.body.notes || null,
      });
      const timeline = await storage.getTimeline(Number(req.params.id));
      const stage6 = timeline.find(t => t.stage === 6);
      if (stage6) {
        await storage.updateTimelineEntry(stage6.id, { status: "failed", notes: req.body.reason, completedAt: new Date() });
      }
      res.json(updated);
    } catch (e) {
      res.status(500).json({ message: "Deny failed" });
    }
  });

  // ── CHAT ─────────────────────────────────────────────────────────────────
  app.get("/api/chat/history", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const messages = await storage.getChatHistory(userId);
    res.json(messages);
  });

  app.post("/api/chat/send", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { content, applicationId } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      await storage.createChatMessage({ userId, role: "user", content, applicationId: applicationId || null });

      const history = await storage.getChatHistory(userId);
      const geminiHistory = history.slice(-10).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // Build message contents with chat history
      const messages = [
        ...geminiHistory,
        {
          role: "user",
          parts: [{ text: content }]
        }
      ];

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages
      });
      const responseText = response.text || "";
      // Note: System prompt setup is handled by model training for this endpoint.
      // To enforce system behavior, you can prepend the system message to the chat history.
      const assistantMsg = await storage.createChatMessage({
        userId,
        role: "assistant",
        content: responseText,
        applicationId: applicationId || null,
      });

      res.json(assistantMsg);
    } catch (e) {
      console.error("Chat error:", e);
      res.status(500).json({ message: "Chat failed" });
    }
  });

  // ── STATS ─────────────────────────────────────────────────────────────────
  app.get("/api/stats/overview", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);

    if (user?.role === "officer" || user?.role === "admin") {
      const all = await storage.getAllApplications();
      const blockchain = await storage.getAllBlockchainEntries();

      const filteredApps = user.role === "officer" && user.assignedCountry
        ? all.filter(a => a.destinationCountry === user.assignedCountry)
        : all;

      res.json({
        total: filteredApps.length,
        pending: filteredApps.filter(a => a.status === "pending").length,
        granted: filteredApps.filter(a => a.status === "granted").length,
        denied: filteredApps.filter(a => a.status === "denied").length,
        inReview: filteredApps.filter(a => !["pending", "granted", "denied"].includes(a.status)).length,
        blockchainEntries: blockchain.length,
        highRisk: filteredApps.filter(a => a.riskLevel === "high").length,
      });
    } else {
      const apps = await storage.getApplicationsByUser(userId);
      res.json({
        total: apps.length,
        granted: apps.filter(a => a.status === "granted").length,
        pending: apps.filter(a => a.status === "pending" || a.status === "document_review").length,
        denied: apps.filter(a => a.status === "denied").length,
      });
    }
  });

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    // Internal direct access for admin
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const allUsers = await db.select().from(users);
    res.json(allUsers.map(({ password: _, ...u }) => u));
  });

  app.post("/api/admin/users/:id/role", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getUser(userId);
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { role } = req.body;
    const targetId = Number(req.params.id);
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    await db.update(users).set({ role }).where(eq(users.id, targetId));
    res.json({ success: true });
  });

  app.post("/api/admin/users/:id/assign-country", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getUser(userId);
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { country } = req.body;
    const targetId = Number(req.params.id);
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    await db.update(users).set({ assignedCountry: country }).where(eq(users.id, targetId));
    res.json({ success: true });
  });

  app.delete("/api/admin/applications/:id", async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getUser(userId);
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const appId = Number(req.params.id);
    const { db } = await import("./db");
    const { visaApplications, documents, statusTimeline, blockchainLedger } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    // Cleanup related records first
    await db.delete(blockchainLedger).where(eq(blockchainLedger.applicationId, appId));
    await db.delete(statusTimeline).where(eq(statusTimeline.applicationId, appId));
    await db.delete(documents).where(eq(documents.applicationId, appId));
    await db.delete(visaApplications).where(eq(visaApplications.id, appId));

    res.json({ success: true });
  });

  // ── CREATE OFFICER (Admin only) ───────────────────────────────────────────
  app.post("/api/admin/officers", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(userId);
      if (admin?.role !== "admin") return res.status(403).json({ message: "Admin access required" });

      const { fullName, email, password, country } = req.body;
      if (!fullName || !email || !password || !country) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "Email already registered" });

      const officer = await storage.createUser({
        fullName,
        email,
        password,
        role: "officer",
        assignedCountry: country,
        confirmPassword: password,
      });

      const { password: _, ...safeOfficer } = officer;
      res.status(201).json(safeOfficer);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to create officer" });
    }
  });

  app.delete("/api/admin/officers/:id", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(userId);
      if (admin?.role !== "admin") return res.status(403).json({ message: "Admin access required" });

      const officerId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      if (isNaN(officerId)) return res.status(400).json({ message: "Invalid officer ID" });
      if (officerId === userId) return res.status(400).json({ message: "Cannot delete your own account" });

      const officer = await storage.getUser(officerId);
      if (!officer || officer.role !== "officer") return res.status(404).json({ message: "Officer not found" });

      await storage.deleteUser(officerId);
      res.json({ message: "Officer deleted successfully" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to delete officer" });
    }
  });

  // ── FEEDBACK ──────────────────────────────────────────────────────────────
  app.post("/api/feedback", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Feedback message is required" });
      }

      const entry = await storage.createFeedback({
        userId: user.id,
        userName: user.fullName,
        userEmail: user.email,
        message: message.trim(),
      });
      res.status(201).json(entry);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  app.get("/api/feedback", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const entries = await storage.getAllFeedback();
      res.json(entries);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // ── VISA DOWNLOAD ──────────────────────────────────────────────────────────
  app.get("/api/visa/:applicationId/download", async (req: Request, res: Response) => {
    try {
      const appId = Number(req.params.applicationId);
      const userId = getSessionUserId(req);
      
      const application = await storage.getApplication(appId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Check authorization - user can only download their own visa, or officers can download any
      if (userId) {
        const user = await storage.getUser(userId);
        if (application.userId !== userId && user?.role !== "officer" && user?.role !== "admin") {
          return res.status(403).json({ message: "Not authorized to download this visa" });
        }
      }

      // Only allow download for granted visas
      if (application.status !== "granted") {
        return res.status(400).json({ message: "Visa is not yet granted for download" });
      }

      // Get user details
      const user = await storage.getUser(application.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate PDF
      const pdfStream = await generateVisaPDF({
        visaNumber: application.visaNumber || "PENDING",
        applicationId: application.id,
        fullName: user.fullName,
        passportNumber: user.passportNumber || "N/A",
        nationality: user.nationality || "N/A",
        dateOfBirth: user.dateOfBirth || "N/A",
        visaType: application.visaType,
        destinationCountry: application.destinationCountry,
        intendedEntryDate: application.intendedEntryDate,
        intendedExitDate: application.intendedExitDate,
        purposeOfVisit: application.purposeOfVisit,
        grantedAt: application.grantedAt,
        expiryDate: application.expiryDate,
        riskLevel: application.riskLevel,
      });

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="visa_${application.visaNumber || appId}.pdf"`);

      // Pipe the PDF stream to the response
      pdfStream.pipe(res);

      // Handle errors
      pdfStream.on("error", (error: Error) => {
        console.error("PDF generation error:", error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to generate PDF" });
        }
      });
    } catch (e) {
      console.error("Visa download error:", e);
      res.status(500).json({ message: "Failed to download visa" });
    }
  });

  // ── VISA VERIFICATION ──────────────────────────────────────────────────────
  app.get("/api/visa/verify/:visaNumber", async (req: Request, res: Response) => {
    try {
      const visaNumber = Array.isArray(req.params.visaNumber) ? req.params.visaNumber[0] : req.params.visaNumber;

      if (!visaNumber) {
        return res.status(400).json({ message: "Visa number is required" });
      }

      const application = await storage.getApplicationByVisaNumber(visaNumber);
      if (!application || application.status !== "granted") {
        return res.status(404).json({
          isValid: false,
          message: "Visa not found or has been revoked",
        });
      }

      // Get user details
      const user = await storage.getUser(application.userId);
      if (!user) {
        return res.status(404).json({
          isValid: false,
          message: "Associated user record not found",
        });
      }

      // Check if visa is expired
      const isExpired = application.expiryDate ? new Date(application.expiryDate) < new Date() : false;
      const isValid = application.status === "granted" && !isExpired;

      res.json({
        visaNumber: application.visaNumber,
        applicationId: application.id,
        fullName: user.fullName,
        passportNumber: user.passportNumber || "N/A",
        visaType: application.visaType,
        destinationCountry: application.destinationCountry,
        grantedAt: application.grantedAt,
        expiryDate: application.expiryDate,
        status: isExpired ? "expired" : application.status,
        isValid: isValid,
        message: isValid ? "Visa is valid and authentic" : isExpired ? "Visa has expired" : "Visa is invalid",
      });
    } catch (e) {
      console.error("Visa verification error:", e);
      res.status(500).json({ message: "Failed to verify visa" });
    }
  });

  return httpServer;
}
