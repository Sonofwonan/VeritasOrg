import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Target, TrendingUp, Home, GraduationCap, Heart, PieChart, Plus } from "lucide-react";

const GOAL_TEMPLATES = [
  { id: "retirement", name: "Retirement", icon: PieChart, targetAmount: "1000000", timeline: "30 years", description: "Build wealth for retirement" },
  { id: "home", name: "Home Purchase", icon: Home, targetAmount: "250000", timeline: "5 years", description: "Save for down payment" },
  { id: "education", name: "Education", icon: GraduationCap, targetAmount: "100000", timeline: "10 years", description: "Save for college or further education" },
  { id: "vacation", name: "Vacation", icon: Heart, targetAmount: "10000", timeline: "1 year", description: "Dream vacation fund" },
];

export default function GoalsPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("retirement");
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  const [goals, setGoals] = useState<any[]>([
    { id: 1, name: "Retirement Fund", target: 1000000, current: 245000, deadline: "2055", progress: 24.5, icon: PieChart },
    { id: 2, name: "Home Down Payment", target: 250000, current: 85000, deadline: "2030", progress: 34, icon: Home },
    { id: 3, name: "College Fund", target: 100000, current: 45000, deadline: "2033", progress: 45, icon: GraduationCap },
  ]);

  const handleCreateGoal = () => {
    if (!goalName || !targetAmount || !deadline) {
      toast({ title: "Incomplete form", variant: "destructive" });
      return;
    }

    const template = GOAL_TEMPLATES.find(t => t.id === selectedTemplate);
    const newGoal = {
      id: Math.max(...goals.map(g => g.id), 0) + 1,
      name: goalName,
      target: parseInt(targetAmount),
      current: 0,
      deadline,
      progress: 0,
      icon: template?.icon || Target,
    };

    setGoals([...goals, newGoal]);
    setIsOpen(false);
    setGoalName("");
    setTargetAmount("");
    setDeadline("");
    
    toast({ title: "Goal Created", description: `${goalName} goal has been created successfully!` });
  };

  const calculateMonthlyContribution = (target: number, current: number, years: number) => {
    const remaining = target - current;
    const months = years * 12;
    return remaining / months;
  };

  return (
    <LayoutShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display">Financial Goals</h2>
          <p className="text-muted-foreground">Track and achieve your financial milestones</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Financial Goal</DialogTitle>
              <DialogDescription>
                Set a specific financial goal and track your progress toward it
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Goal Type</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_TEMPLATES.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Goal Name</Label>
                <Input 
                  placeholder="e.g., Retirement at 65"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Target Amount ($)</Label>
                <Input 
                  type="number"
                  placeholder="1000000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Target Date</Label>
                <Input 
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateGoal}>Create Goal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {goals.map(goal => {
          const Icon = goal.icon;
          const yearsRemaining = new Date(goal.deadline).getFullYear() - new Date().getFullYear();
          const monthlyAmount = calculateMonthlyContribution(goal.target, goal.current, yearsRemaining || 1);

          return (
            <Card key={goal.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{goal.name}</CardTitle>
                      <CardDescription>Target: ${goal.target.toLocaleString()}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={goal.progress >= 50 ? "default" : "secondary"}>
                    {goal.progress}% Complete
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Current Amount</p>
                    <p className="text-2xl font-bold">${goal.current.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Target Deadline</p>
                    <p className="text-2xl font-bold">{goal.deadline}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Monthly Contribution</p>
                    <p className="text-2xl font-bold text-green-600">${Math.round(monthlyAmount).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground">${goal.current.toLocaleString()} of ${goal.target.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-semibold mb-2">Recommended Strategy:</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>✓ Contribute ${Math.round(monthlyAmount).toLocaleString()} monthly to stay on track</li>
                    <li>✓ Consider a {yearsRemaining > 10 ? 'growth-oriented' : 'balanced'} investment allocation</li>
                    <li>✓ Review and rebalance quarterly</li>
                    <li>✓ Automate contributions for consistency</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-12">
        <h3 className="text-xl font-bold mb-4">Popular Goal Templates</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GOAL_TEMPLATES.map(template => {
            const Icon = template.icon;
            return (
              <Card key={template.id} className="hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer">
                <CardContent className="pt-6">
                  <Icon className="w-8 h-8 text-primary mb-2" />
                  <h4 className="font-semibold mb-1">{template.name}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{template.description}</p>
                  <div className="text-xs space-y-1">
                    <p><span className="font-medium">Target:</span> ${parseInt(template.targetAmount).toLocaleString()}</p>
                    <p><span className="font-medium">Timeline:</span> {template.timeline}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </LayoutShell>
  );
}
