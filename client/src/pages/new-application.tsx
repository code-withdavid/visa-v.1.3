import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, FilePlus, Globe, Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  applicationType: z.string(),
  visaType: z.string().min(1, "Visa type is required"),
  destinationCountry: z.string().min(2, "Destination country is required"),
  purposeOfVisit: z.string().min(10, "Please describe your purpose (at least 10 characters)"),
  intendedEntryDate: z.string().optional(),
  intendedExitDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const VISA_TYPES = [
  { value: "tourist", label: "Tourist Visa" },
  { value: "student", label: "Student Visa" },
  { value: "work", label: "Work Visa" },
  { value: "business", label: "Business Visa" },
  { value: "transit", label: "Transit Visa" },
  { value: "family", label: "Family Reunification" },
];

const POPULAR_COUNTRIES = [
  "United States", "United Kingdom", "France", "Germany", "Canada",
  "Australia", "Japan", "UAE", "Netherlands", "Spain", "Italy", "Portugal",
];

const DOCUMENT_REQUIREMENTS: Record<string, string[]> = {
  tourist: ["Valid Passport", "Passport Photo", "Bank Statement", "Travel Itinerary", "Travel Insurance"],
  student: ["Valid Passport", "Acceptance Letter", "Financial Proof", "Academic Records", "Medical Certificate"],
  work: ["Valid Passport", "Job Offer Letter", "Educational Certificates", "Bank Statement", "Medical Certificate"],
  business: ["Valid Passport", "Business Invitation", "Company Registration", "Bank Statement", "Business Plan"],
  transit: ["Valid Passport", "Onward Ticket", "Destination Visa", "Travel Itinerary"],
  family: ["Valid Passport", "Sponsor Proof", "Relationship Documents", "Financial Support Letter"],
};

export default function NewApplication() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      applicationType: "new",
      visaType: "",
      destinationCountry: "",
      purposeOfVisit: "",
      intendedEntryDate: "",
      intendedExitDate: "",
    },
  });

  const visaType = form.watch("visaType");
  const requirements = visaType ? DOCUMENT_REQUIREMENTS[visaType] || [] : [];

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/applications", data);
      return res.json();
    },
    onSuccess: (app) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ title: "Application Created", description: "Your application has been submitted successfully." });
      navigate(`/applications/${app.id}`);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Visa Application</h1>
          <p className="text-muted-foreground text-sm">Fill in the details to begin your application</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-primary" />
                Application Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="applicationType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-application-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">New Application</SelectItem>
                            <SelectItem value="renewal">Renewal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="visaType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visa Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-visa-type">
                              <SelectValue placeholder="Select visa type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {VISA_TYPES.map(v => (
                              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="destinationCountry" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Country</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-destination">
                            <SelectValue placeholder="Select destination" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {POPULAR_COUNTRIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="purposeOfVisit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose of Visit</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the purpose of your visit in detail..."
                          className="min-h-[80px]"
                          data-testid="textarea-purpose"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="intendedEntryDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entry Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-entry-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="intendedExitDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exit Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-exit-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={mutation.isPending}
                    data-testid="button-submit-application"
                  >
                    {mutation.isPending ? "Submitting..." : "Submit Application"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Required Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requirements.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select a visa type to see requirements</p>
              ) : (
                <ul className="space-y-1.5">
                  {requirements.map(r => (
                    <li key={r} className="text-xs flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plane className="w-4 h-4 text-primary" />
                AI Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                "Documents verified by AI within minutes",
                "Risk score calculated automatically",
                "Blockchain record created on approval",
                "Real-time status tracking throughout",
              ].map(item => (
                <div key={item} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
