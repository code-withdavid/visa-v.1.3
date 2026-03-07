import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import {
  users, visaApplications, documents, statusTimeline, chatMessages, blockchainLedger, feedback,
  type User, type InsertUser,
  type VisaApplication, type InsertVisaApplication,
  type Document, type InsertDocument,
  type StatusTimeline, type ChatMessage, type BlockchainLedgerEntry,
  type Feedback, type InsertFeedback,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Applications
  getApplication(id: number): Promise<VisaApplication | undefined>;
  getApplicationsByUser(userId: number): Promise<VisaApplication[]>;
  getAllApplications(): Promise<VisaApplication[]>;
  createApplication(app: InsertVisaApplication & { userId: number }): Promise<VisaApplication>;
  updateApplication(id: number, updates: Partial<VisaApplication>): Promise<VisaApplication>;

  // Documents
  getDocumentsByApplication(applicationId: number): Promise<Document[]>;
  createDocument(doc: InsertDocument & { applicationId: number }): Promise<Document>;
  updateDocument(id: number, updates: Partial<Document>): Promise<Document>;

  // Timeline
  getTimeline(applicationId: number): Promise<StatusTimeline[]>;
  createTimelineEntry(entry: Omit<StatusTimeline, "id" | "createdAt">): Promise<StatusTimeline>;
  updateTimelineEntry(id: number, updates: Partial<StatusTimeline>): Promise<StatusTimeline>;

  // Chat
  getChatHistory(userId: number): Promise<ChatMessage[]>;
  createChatMessage(msg: Omit<ChatMessage, "id" | "createdAt">): Promise<ChatMessage>;

  // Blockchain
  getBlockchainEntry(applicationId: number): Promise<BlockchainLedgerEntry | undefined>;
  getBlockchainByHash(hash: string): Promise<BlockchainLedgerEntry | undefined>;
  getAllBlockchainEntries(): Promise<BlockchainLedgerEntry[]>;
  createBlockchainEntry(entry: Omit<BlockchainLedgerEntry, "id" | "issuedAt">): Promise<BlockchainLedgerEntry>;
  getLatestBlockchainEntry(): Promise<BlockchainLedgerEntry | undefined>;

  // Feedback
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
}

class DatabaseStorage implements IStorage {
  // ── Users ──────────────────────────────────────────────────────────────────
  async getUser(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: any) {
    const { confirmPassword, ...userData } = user;
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [created] = await db.insert(users).values({
      ...userData,
      password: hashedPassword,
      role: userData.role || "applicant",
      assignedCountry: userData.assignedCountry || null,
      nationality: userData.nationality || null,
      passportNumber: userData.passportNumber || null,
      dateOfBirth: userData.dateOfBirth || null,
      phone: userData.phone || null,
    }).returning();
    return created;
  }

  async updateUser(id: number, updates: Partial<User>) {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ── Applications ───────────────────────────────────────────────────────────
  async getApplication(id: number) {
    const [app] = await db.select().from(visaApplications).where(eq(visaApplications.id, id));
    return app;
  }

  async getApplicationsByUser(userId: number) {
    return db.select().from(visaApplications)
      .where(eq(visaApplications.userId, userId))
      .orderBy(desc(visaApplications.createdAt));
  }

  async getAllApplications() {
    return db.select().from(visaApplications).orderBy(desc(visaApplications.createdAt));
  }

  async createApplication(app: InsertVisaApplication & { userId: number }) {
    const [created] = await db.insert(visaApplications).values(app).returning();
    return created;
  }

  async updateApplication(id: number, updates: Partial<VisaApplication>) {
    const [updated] = await db.update(visaApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(visaApplications.id, id))
      .returning();
    return updated;
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  async getDocumentsByApplication(applicationId: number) {
    return db.select().from(documents).where(eq(documents.applicationId, applicationId));
  }

  async createDocument(doc: InsertDocument & { applicationId: number }) {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async updateDocument(id: number, updates: Partial<Document>) {
    const [updated] = await db.update(documents).set(updates).where(eq(documents.id, id)).returning();
    return updated;
  }

  // ── Timeline ───────────────────────────────────────────────────────────────
  async getTimeline(applicationId: number) {
    return db.select().from(statusTimeline)
      .where(eq(statusTimeline.applicationId, applicationId))
      .orderBy(statusTimeline.stage);
  }

  async createTimelineEntry(entry: Omit<StatusTimeline, "id" | "createdAt">) {
    const [created] = await db.insert(statusTimeline).values(entry).returning();
    return created;
  }

  async updateTimelineEntry(id: number, updates: Partial<StatusTimeline>) {
    const [updated] = await db.update(statusTimeline).set(updates).where(eq(statusTimeline.id, id)).returning();
    return updated;
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  async getChatHistory(userId: number) {
    return db.select().from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt)
      .limit(100);
  }

  async createChatMessage(msg: Omit<ChatMessage, "id" | "createdAt">) {
    const [created] = await db.insert(chatMessages).values(msg).returning();
    return created;
  }

  // ── Blockchain ─────────────────────────────────────────────────────────────
  async getBlockchainEntry(applicationId: number) {
    const [entry] = await db.select().from(blockchainLedger)
      .where(eq(blockchainLedger.applicationId, applicationId));
    return entry;
  }

  async getBlockchainByHash(hash: string) {
    const [entry] = await db.select().from(blockchainLedger)
      .where(eq(blockchainLedger.blockHash, hash));
    return entry;
  }

  async getAllBlockchainEntries() {
    return db.select().from(blockchainLedger).orderBy(desc(blockchainLedger.issuedAt));
  }

  async createBlockchainEntry(entry: Omit<BlockchainLedgerEntry, "id" | "issuedAt">) {
    const [created] = await db.insert(blockchainLedger).values(entry).returning();
    return created;
  }

  async getLatestBlockchainEntry() {
    const [entry] = await db.select().from(blockchainLedger)
      .orderBy(desc(blockchainLedger.blockIndex))
      .limit(1);
    return entry;
  }

  async createFeedback(data: InsertFeedback) {
    const [created] = await db.insert(feedback).values(data).returning();
    return created;
  }

  async getAllFeedback() {
    return db.select().from(feedback).orderBy(desc(feedback.createdAt));
  }
}

export const storage = new DatabaseStorage();
