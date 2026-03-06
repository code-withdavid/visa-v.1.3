import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { createHash, randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { sendOTPEmail } from "./email";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

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

      const user = await storage.createUser({
        fullName, email, password,
        role: "applicant",
      });

      const token = createSession(user.id);
      const { password: _, ...safeUser } = user;
      res.status(201).json({ user: safeUser, token });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = createSession(user.id);
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (e) {
      res.status(500).json({ message: "Login failed" });
    }
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
      const { documentType, fileName, fileSize, mimeType } = req.body;
      const doc = await storage.createDocument({
        applicationId: Number(req.params.id),
        documentType,
        fileName,
        fileSize,
        mimeType,
      });
      res.status(201).json(doc);
    } catch (e) {
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // ── AI DOCUMENT VERIFICATION ──────────────────────────────────────────────
  app.post("/api/documents/:docId/verify", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const docId = Number(req.params.docId);

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `You are an AI document verification system for a visa processing platform.
          Simulate verifying a "${req.body.documentType || "document"}" document called "${req.body.fileName || "document.pdf"}".
          Return a JSON object with these fields:
          - verified: boolean
          - confidence: number 0-1
          - notes: string (brief verification notes)
          - extractedData: object with relevant fields (name, dateOfBirth, documentNumber, expiryDate if applicable)
          Return ONLY valid JSON, no markdown.`
        }]
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch { parsed = { verified: true, confidence: 0.92, notes: "Document appears authentic.", extractedData: {} }; }

      const updated = await storage.updateDocument(docId, {
        verified: parsed.verified,
        aiConfidenceScore: parsed.confidence,
        aiVerificationNotes: parsed.notes,
        extractedData: parsed.extractedData || {},
      });
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // ── AI RISK SCORING ───────────────────────────────────────────────────────
  app.post("/api/applications/:id/risk-score", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const app = await storage.getApplication(Number(req.params.id));
      if (!app) return res.status(404).json({ message: "Application not found" });
      const user = await storage.getUser(app.userId);
      const docs = await storage.getDocumentsByApplication(app.id);

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `You are an AI fraud detection and risk scoring engine for a visa processing system.

Applicant details:
- Visa type: ${app.visaType}
- Application type: ${app.applicationType}
- Purpose: ${app.purposeOfVisit}
- Destination: ${app.destinationCountry}
- Nationality: ${user?.nationality || "Unknown"}
- Documents submitted: ${docs.length}
- Documents verified: ${docs.filter(d => d.verified).length}

Generate a risk assessment. Return ONLY valid JSON:
{
  "riskScore": <number 0-100>,
  "riskLevel": "<low|medium|high>",
  "summary": "<2-3 sentence risk assessment summary>",
  "factors": ["<factor1>", "<factor2>", "<factor3>"]
}`
        }]
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch {
        parsed = { riskScore: 25, riskLevel: "low", summary: "Application appears legitimate with standard risk profile.", factors: [] };
      }

      const updated = await storage.updateApplication(app.id, {
        riskScore: parsed.riskScore,
        riskLevel: parsed.riskLevel,
        aiAnalysisSummary: parsed.summary,
      });

      const timeline = await storage.getTimeline(app.id);
      const stage4 = timeline.find(t => t.stage === 4);
      if (stage4 && stage4.status !== "completed") {
        await storage.updateTimelineEntry(stage4.id, { status: "completed", completedAt: new Date() });
      }

      res.json({ ...updated, factors: parsed.factors });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Risk scoring failed" });
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
    const entry = await storage.getBlockchainByHash(req.params.hash);
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

      await storage.createChatMessage({ userId, role: "user", content, applicationId: applicationId || null });

      const history = await storage.getChatHistory(userId);
      const chatHistory = history.slice(-10).map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      const systemPrompt = `You are VisaBot, an intelligent AI assistant for the VisaFlow visa processing system.
You help applicants understand visa requirements, track their application status, guide them through the renewal process, and answer questions about documentation.
Be concise, professional, and helpful. Format responses with bullet points when listing multiple items.`;

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 800,
        system: systemPrompt,
        messages: chatHistory,
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "I apologize, I couldn't generate a response.";

      const assistantMsg = await storage.createChatMessage({
        userId,
        role: "assistant",
        content: responseText,
        applicationId: applicationId || null,
      });

      res.json(assistantMsg);
    } catch (e) {
      console.error(e);
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

  return httpServer;
}
