import { useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, Bell, Palette, Save, MessageSquare, Phone } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/user", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Settings updated", description: "Your changes have been saved successfully." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update settings", 
        variant: "destructive" 
      });
    }
  });

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    marketingEmails: user?.marketingEmails ?? true,
    securityAlerts: user?.securityAlerts ?? true,
    twoFactorEnabled: user?.twoFactorEnabled ?? false,
  });

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  return (
    <LayoutShell>
      <div className="mb-8">
        <h2 className="text-3xl font-bold font-display">Settings</h2>
        <p className="text-muted-foreground">Manage your account preferences and security settings.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[500px]">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4" />
            Display
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Support
          </TabsTrigger>
        </TabsList>

        <TabsContent value="support">
          <Card>
            <CardHeader>
              <CardTitle>Contact Support</CardTitle>
              <CardDescription>Get help with your account or report an issue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-accent/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold">Direct Text Support</p>
                    <p className="text-sm text-muted-foreground">+1 (740) 938-1335</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="sms:+17409381335">Send SMS</a>
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-accent/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold">WhatsApp Support</p>
                    <p className="text-sm text-muted-foreground">+1 (478) 416-5940</p>
                    <p className="text-[10px] text-muted-foreground italic">Messages only</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://wa.me/14784165940" target="_blank" rel="noopener noreferrer">WhatsApp</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details and contact information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  value={formData.phoneNumber} 
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} 
                />
              </div>
              <Button onClick={handleSave} disabled={updateProfileMutation.isPending} className="gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Enhance your account security with two-factor authentication.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                </div>
                <Switch 
                  checked={formData.twoFactorEnabled} 
                  onCheckedChange={(checked) => setFormData({...formData, twoFactorEnabled: checked})} 
                />
              </div>
              <div className="pt-4 border-t">
                <Button variant="outline">Change Password</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Communication Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified about activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Security Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified about login attempts and password changes.</p>
                </div>
                <Switch 
                  checked={formData.securityAlerts} 
                  onCheckedChange={(checked) => setFormData({...formData, securityAlerts: checked})} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">Receive updates about new features and investment insights.</p>
                </div>
                <Switch 
                  checked={formData.marketingEmails} 
                  onCheckedChange={(checked) => setFormData({...formData, marketingEmails: checked})} 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the visual theme of the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2 border-primary">
                  <div className="w-full h-4 bg-background rounded-sm border" />
                  Light Mode
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <div className="w-full h-4 bg-slate-950 rounded-sm border" />
                  Dark Mode
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <div className="w-full h-4 bg-slate-500 rounded-sm border" />
                  System
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </LayoutShell>
  );
}
