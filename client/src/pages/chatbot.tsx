import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Bot, User, MessageSquareText, Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

const QUICK_PROMPTS = [
  "What documents do I need for a tourist visa?",
  "How long does visa processing take?",
  "My visa is expiring soon — how do I renew it?",
  "What is the risk assessment process?",
  "How does the blockchain visa record work?",
  "Can I track my application status in real-time?",
];

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`} data-testid={`message-${msg.id}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? "bg-primary/20" : "bg-accent/20"
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Bot className="w-4 h-4 text-accent" />
        )}
      </div>
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-card-border rounded-tl-sm"
        }`}>
          {msg.content.split("\n").map((line, i) => (
            <span key={i}>{line}{i < msg.content.split("\n").length - 1 && <br />}</span>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground px-1">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function ChatBot() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const historyQuery = useQuery<ChatMessage[]>({ queryKey: ["/api/chat/history"] });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/send", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to send message.", variant: "destructive" }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyQuery.data?.length]);

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    const msg = input.trim();
    setInput("");

    // Optimistically add user message to view
    const optimisticMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: msg,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData(["/api/chat/history"], (old: ChatMessage[] = []) => [...old, optimisticMsg]);

    sendMutation.mutate(msg);
  };

  const messages = historyQuery.data || [];

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="font-bold flex items-center gap-1.5">
              VisaBot
              <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">AI</span>
            </h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-glow" />
              <p className="text-xs text-muted-foreground">Online — Powered by Claude</p>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] })}
          data-testid="button-refresh-chat"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {historyQuery.isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-16 w-3/4" />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Hello! I'm VisaBot</h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                I'm your AI visa assistant. Ask me anything about visa applications, requirements, renewals, or the processing system.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => { setInput(p); }}
                  className="text-left text-xs p-3 rounded-md border border-border bg-card hover-elevate transition-all"
                  data-testid={`quick-prompt-${p.slice(0, 20).replace(/\s/g, "-")}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Welcome message */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-accent/20">
                <Bot className="w-4 h-4 text-accent" />
              </div>
              <div className="max-w-[75%]">
                <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-card border border-card-border rounded-tl-sm">
                  Hello! I'm VisaBot, your AI visa assistant powered by Claude. I can help you with visa requirements, application status, renewal guidance, and more. How can I assist you today?
                </div>
              </div>
            </div>

            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

            {sendMutation.isPending && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-accent/20">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
                <div className="bg-card border border-card-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts (when messages exist) */}
      {messages.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {QUICK_PROMPTS.slice(0, 4).map(p => (
            <button
              key={p}
              onClick={() => setInput(p)}
              className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover-elevate transition-all whitespace-nowrap"
            >
              {p.length > 35 ? p.slice(0, 35) + "..." : p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <Textarea
            placeholder="Ask VisaBot anything about visa applications..."
            className="min-h-[44px] max-h-[120px] resize-none"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-testid="textarea-chat-input"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            data-testid="button-send-chat"
            className="flex-shrink-0 h-11 w-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
